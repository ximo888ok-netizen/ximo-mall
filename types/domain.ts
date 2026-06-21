export const platformOptions = [
  "general_ecommerce",
  "taobao_tmall",
  "pinduoduo",
  "xiaohongshu",
  "douyin_ecommerce",
] as const;

export const styleOptions = [
  "minimalist",
  "guochao_illustration",
  "vintage_chinese",
  "creative_handdrawn",
  "ink_wash",
  "infographic",
  "c4d_3d",
  "street_appetite",
  "realistic_food_photo",
  "japanese_fresh",
  "warm_homestyle",
  "regional_memory",
  "lifestyle_scene",
  "premium_product",
  "festival_promo",
  "healthy_light",
  "cute_cartoon",
  "baby_parenting",
  "tech_geometric",
  "dynamic_video",
] as const;

export const platformLabels: Record<(typeof platformOptions)[number], string> = {
  general_ecommerce: "通用电商",
  taobao_tmall: "淘宝 / 天猫",
  pinduoduo: "拼多多",
  xiaohongshu: "小红书",
  douyin_ecommerce: "抖音电商",
};

export const styleLabels: Record<(typeof styleOptions)[number], string> = {
  minimalist: "极简主义风",
  guochao_illustration: "国潮插画风",
  vintage_chinese: "复古中国风",
  creative_handdrawn: "创意手绘/涂鸦风",
  ink_wash: "意境山水/水墨风",
  infographic: "现代信息图表风",
  c4d_3d: "C4D/3D立体风",
  street_appetite: "浓郁食欲/街潮风",
  realistic_food_photo: "真实诱人美食摄影风",
  japanese_fresh: "日系清新/文艺风",
  warm_homestyle: "温暖家常/亲民风",
  regional_memory: "地域风情/城市记忆风",
  lifestyle_scene: "简约实景/生活化场景风",
  premium_product: "精修产品/高端质感风",
  festival_promo: "节日促销/大促氛围风",
  healthy_light: "健康/轻食代餐风",
  cute_cartoon: "憨萌卡通/童趣风",
  baby_parenting: "母婴亲子/宝宝辅食风",
  tech_geometric: "参数化/科技几何风",
  dynamic_video: "动态/短视频风格",
};

export const styleCategories: Record<string, string[]> = {
  "摄影写实": ["minimalist", "street_appetite", "realistic_food_photo", "japanese_fresh", "premium_product", "healthy_light"],
  "插画艺术": ["guochao_illustration", "vintage_chinese", "creative_handdrawn", "cute_cartoon"],
  "促销营销": ["festival_promo"],
  "场景叙事": ["warm_homestyle", "regional_memory", "lifestyle_scene", "baby_parenting"],
  "概念创意": ["ink_wash", "infographic", "c4d_3d", "tech_geometric", "dynamic_video"],
};

export const assetTypeLabels = {
  MAIN: "主商品图",
  ANGLE: "多角度图",
  DETAIL: "细节图",
  REFERENCE: "参考图",
  GENERATED: "生成图",
  EXPORTED: "导出文件",
} as const;

export const sectionTypes = [
  "hero",
  "selling_points",
  "scenario",
  "detail_closeup",
  "specs",
  "material",
  "comparison",
  "gift_scene",
  "brand_trust",
  "summary",
  "custom",
] as const;

export const sectionTypeLabels: Record<(typeof sectionTypes)[number], string> = {
  hero: "头图主视觉",
  selling_points: "卖点模块",
  scenario: "场景展示",
  detail_closeup: "细节特写",
  specs: "规格参数",
  material: "材质工艺",
  comparison: "对比说明",
  gift_scene: "送礼场景",
  brand_trust: "品牌信任",
  summary: "总结收口",
  custom: "自定义模块",
};

export const capabilityKeys = [
  "text",
  "vision",
  "image_gen",
  "image_edit",
  "structured_output",
  "fast",
  "cheap",
  "high_quality",
] as const;

export const capabilityLabels: Record<(typeof capabilityKeys)[number], string> = {
  text: "文本",
  vision: "视觉理解",
  image_gen: "图像生成",
  image_edit: "图像编辑",
  structured_output: "结构化输出",
  fast: "速度快",
  cheap: "成本低",
  high_quality: "高质量",
};

export const roleKeys = [
  "analysis",
  "planning",
  "hero_image",
  "detail_image",
  "image_edit",
] as const;

export const roleLabels: Record<(typeof roleKeys)[number], string> = {
  analysis: "商品分析",
  planning: "文案规划",
  hero_image: "头图生成",
  detail_image: "详情图生成",
  image_edit: "图像编辑",
};

export const statusLabels: Record<string, string> = {
  IDLE: "未开始",
  QUEUED: "排队中",
  GENERATING: "生成中",
  SUCCESS: "已完成",
  FAILED: "失败",
  DRAFT: "草稿",
  ANALYZED: "已分析",
  PLANNED: "已规划",
  EDITING: "编辑中",
  COMPLETED: "已完成",
};

export type PlatformOption = (typeof platformOptions)[number];
export type StyleOption = (typeof styleOptions)[number];
export type SectionTypeKey = (typeof sectionTypes)[number];
export type CapabilityKey = (typeof capabilityKeys)[number];
export type ModelRoleKey = (typeof roleKeys)[number];
export type EndpointProbeState = "available" | "unavailable" | "rate_limited" | "unknown" | "not_applicable";

export type CapabilityMap = Record<CapabilityKey, boolean> & {
  real_image_gen?: boolean;
  real_image_edit?: boolean;
};

export type ModelRoleMap = Record<ModelRoleKey, boolean>;

export interface ProviderConnectionInput {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface ModelEndpointSupport {
  imageGeneration: EndpointProbeState;
  imageEdit: EndpointProbeState;
  note?: string | null;
}

export interface ModelDetectionResult {
  modelId: string;
  label: string;
  capabilities: CapabilityMap;
  roles: ModelRoleMap;
  quality?: string | null;
  latency?: string | null;
  cost?: string | null;
  isAvailable: boolean;
  endpointSupport?: ModelEndpointSupport;
}

export interface AssociatedImageContext {
  index: number;
  fileName: string;
  sceneDescription: string;
  productRelationship: string;
  visualElements: string[];
  compositionStyle: string;
  lightingAndColor: string;
  propsAndEnvironment: string[];
  usageScenario: string;
}

export interface ProductAnalysisResult {
  productName: string;
  category: string;
  subcategory: string;
  material: string;
  color: string;
  styleTags: string[];
  targetAudience: string[];
  usageScenarios: string[];
  coreSellingPoints: string[];
  differentiationPoints: string[];
  userConcerns: string[];
  recommendedFocusPoints: string[];
  suggestedSectionPlan: Array<{
    type: SectionTypeKey;
    title: string;
    goal: string;
  }>;
  associatedImageContexts?: AssociatedImageContext[];
}

export interface PlannedSectionInput {
  id: string;
  type: SectionTypeKey;
  title: string;
  goal: string;
  copy: string;
  visualPrompt: string;
  imageStatus: "idle" | "queued" | "generating" | "success" | "failed";
  imageUrl?: string | null;
  editableFields: Record<string, unknown>;
}

export type StyleBackground = {
  material: string;
  color: string;
};

export type StyleLighting = {
  direction: string;
  quality: string;
  colorTemp: string;
};

export type StyleSubject = {
  description: string;
  coverage: string;
  state: string;
};

export type StyleComposition = {
  method: string;
  angle: string;
};

export type StyleMarketingStyle = {
  colorFamily: string;
  materialPreference: string;
  coverageHint: string;
};

export type StyleTemplate = {
  key: string;
  label: string;
  category: string;
  background: StyleBackground;
  lighting: StyleLighting;
  subject: StyleSubject;
  composition: StyleComposition;
  props: string[];
  effects: string[];
  fullness: { level: string };
  marketingStyle: StyleMarketingStyle;
};
