/**
 * 规划结果校验器 — 对 AI 规划输出做后置校验
 *
 * 解决"光说不验"问题：prompt 里的量化约束（如≤30%词重叠、禁用词）
 * 全靠 LLM 自觉，本模块用程序化方式验证是否真的做到。
 *
 * 设计原则：
 * - 不阻断流程（校验失败只记录警告，不抛错）
 * - 返回结构化结果，供调用方决策
 * - 纯文本校验，不依赖图像处理（图片校验在生成阶段）
 */

/** 校验警告项 */
export interface ValidationWarning {
  /** 警告类型 */
  type: "copy_overlap" | "forbidden_words" | "copy_too_short" | "missing_visual_prompt_font";
  /** 警告消息 */
  message: string;
  /** 涉及的 section id */
  sectionIds?: string[];
  /** 具体数值（如重叠率） */
  value?: number;
}

/** 校验结果 */
export interface ValidationResult {
  /** 是否通过（无警告则通过） */
  passed: boolean;
  /** 警告列表 */
  warnings: ValidationWarning[];
  /** 校验的 section 总数 */
  totalSections: number;
}

/** 规划 section 的最小结构 */
interface SectionForValidation {
  id: string;
  type: string;
  title: string;
  copy: string;
  visualPrompt: string;
}

/**
 * 禁用词清单 — 模糊炒作词汇
 * 来自 planning.ts 的 FORBIDDEN PATTERNS 规则
 */
const FORBIDDEN_WORDS = [
  "爆款",
  "必抢",
  "疯抢",
  "全网最低价",
  "神器",
  "绝绝子",
  "yyds",
  "吊打",
  "秒杀一切",
  "无敌",
];

/**
 * 中文分词（简易版）— 按 2-4 字滑窗提取词组
 * 不依赖 jieba 等分词库，用 n-gram 方式提取关键短语
 */
function tokenizeChinese(text: string): Set<string> {
  const tokens = new Set<string>();
  const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ").trim();

  if (!cleaned) return tokens;

  // 2-gram 和 3-gram 滑窗
  const chars = cleaned.split(/\s+/).join("");
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= chars.length - n; i++) {
      const token = chars.slice(i, i + n);
      // 过滤纯数字和单字重复
      if (!/^\d+$/.test(token) && !/(.)\1{2,}/.test(token)) {
        tokens.add(token);
      }
    }
  }

  return tokens;
}

/**
 * 计算 Jaccard 相似度（交集/并集）
 * 用于衡量两段文案的词重叠率
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 校验文案词重叠率
 * 规则：同类型 section 之间的 copy 词重叠率应 ≤30%
 *
 * @param sections 待校验的 section 列表
 * @param threshold 重叠率阈值，默认 0.3（30%）
 * @returns 警告列表
 */
function validateCopyOverlap(
  sections: SectionForValidation[],
  threshold = 0.3,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 按类型分组（头图一组，详情页一组）
  const groups = new Map<string, { section: SectionForValidation; tokens: Set<string> }[]>();

  for (const section of sections) {
    const groupKey = section.type === "hero" || section.type === "HERO" ? "hero" : "detail";
    const list = groups.get(groupKey) ?? [];
    list.push({ section, tokens: tokenizeChinese(section.copy) });
    groups.set(groupKey, list);
  }

  // 组内两两比较
  for (const [, list] of groups) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const overlap = jaccardSimilarity(list[i].tokens, list[j].tokens);
        if (overlap > threshold) {
          warnings.push({
            type: "copy_overlap",
            message: `文案词重叠率 ${(overlap * 100).toFixed(1)}% 超过阈值 ${threshold * 100}%，建议差异化重写`,
            sectionIds: [list[i].section.id, list[j].section.id],
            value: overlap,
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * 校验禁用词
 * 规则：copy 字段不得包含模糊炒作词汇
 *
 * @param sections 待校验的 section 列表
 * @returns 警告列表
 */
function validateForbiddenWords(sections: SectionForValidation[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const section of sections) {
    const lowerCopy = section.copy.toLowerCase();
    const found = FORBIDDEN_WORDS.filter((word) => lowerCopy.includes(word.toLowerCase()));

    if (found.length > 0) {
      warnings.push({
        type: "forbidden_words",
        message: `文案包含禁用炒作词汇: ${found.join("、")}`,
        sectionIds: [section.id],
      });
    }
  }

  return warnings;
}

/**
 * 校验文案密度
 * 规则：每个 section 的 copy 字段应 ≥30 字
 *
 * @param sections 待校验的 section 列表
 * @returns 警告列表
 */
function validateCopyDensity(sections: SectionForValidation[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const section of sections) {
    // 去除空白后的字符数
    const charCount = section.copy.replace(/\s/g, "").length;
    if (charCount < 30) {
      warnings.push({
        type: "copy_too_short",
        message: `文案密度不足: ${charCount} 字（要求≥30字），建议补充具体卖点数据`,
        sectionIds: [section.id],
        value: charCount,
      });
    }
  }

  return warnings;
}

/**
 * 校验 visualPrompt 是否包含字体指令
 * 规则：改进点 3 要求 visualPrompt 必须指定字体类型/字号/字重
 *
 * @param sections 待校验的 section 列表
 * @returns 警告列表
 */
function validateVisualPromptFont(sections: SectionForValidation[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const fontKeywords = [
    "思源黑体",
    "Source Han Sans",
    "阿里巴巴普惠体",
    "Inter",
    "Helvetica",
    "Bold",
    "SemiBold",
    "Black",
    "pt",
    "字号",
    "字重",
    "font",
  ];

  for (const section of sections) {
    const promptLower = section.visualPrompt.toLowerCase();
    const hasFontInstruction = fontKeywords.some((kw) =>
      promptLower.includes(kw.toLowerCase()),
    );

    if (!hasFontInstruction) {
      warnings.push({
        type: "missing_visual_prompt_font",
        message: "visualPrompt 未包含字体指令（类型/字号/字重），建议补充如'主标题用思源黑体 Bold 72pt'",
        sectionIds: [section.id],
      });
    }
  }

  return warnings;
}

/**
 * 主校验入口 — 对规划结果做全面校验
 *
 * @param sections AI 规划输出的 section 列表
 * @returns 校验结果（含所有警告）
 */
export function validatePlanResult(sections: SectionForValidation[]): ValidationResult {
  const warnings: ValidationWarning[] = [];

  // 1. 文案词重叠校验
  warnings.push(...validateCopyOverlap(sections));

  // 2. 禁用词校验
  warnings.push(...validateForbiddenWords(sections));

  // 3. 文案密度校验
  warnings.push(...validateCopyDensity(sections));

  // 4. 字体指令校验（改进点 3 配套）
  warnings.push(...validateVisualPromptFont(sections));

  return {
    passed: warnings.length === 0,
    warnings,
    totalSections: sections.length,
  };
}

/**
 * 将校验结果格式化为日志字符串
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.passed) {
    return `[Plan Validator] ✅ 校验通过（${result.totalSections} 个 section）`;
  }

  const lines = [
    `[Plan Validator] ⚠️ 发现 ${result.warnings.length} 个警告（${result.totalSections} 个 section）:`,
  ];

  for (const w of result.warnings) {
    const ids = w.sectionIds ? ` [${w.sectionIds.join(", ")}]` : "";
    const val = w.value !== undefined ? ` (${w.value})` : "";
    lines.push(`  - [${w.type}] ${w.message}${ids}${val}`);
  }

  return lines.join("\n");
}
