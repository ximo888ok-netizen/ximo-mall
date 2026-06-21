"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  FolderKanban, Search, Play, RotateCcw, Copy, Check,
  Zap, Brain, Image, Settings, BarChart3, 
  ChevronRight, Loader2, CheckCircle2, XCircle,
  FileJson, Download, Upload, Tag, Layers, BookOpen,
  Link, Key, RefreshCw, Wifi, WifiOff, Globe, Lock,
  Eye, EyeOff, Server, Shield
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// MCP 工具定义
interface MCPTool {
  name: string;
  description: string;
  category: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  params: Record<string, {
    type: string;
    required: boolean;
    description: string;
  }>;
}

const MCP_TOOLS: MCPTool[] = [
  // 项目管理
  { name: "列出所有项目", description: "获取 Ximo Mall 中所有项目的列表", category: "项目管理", method: "GET", params: {} },
  { name: "创建新项目", description: "在 Ximo Mall 中创建新的商品详情页项目", category: "项目管理", method: "POST", params: { name: { type: "string", required: true, description: "项目名称" }, platform: { type: "string", required: true, description: "目标平台" }, style: { type: "string", required: true, description: "视觉风格" }, description: { type: "string", required: false, description: "项目描述" } } },
  { name: "获取项目详情", description: "根据 ID 获取单个项目的详细信息", category: "项目管理", method: "GET", params: { id: { type: "string", required: true, description: "项目 ID" } } },
  { name: "更新项目", description: "更新已有项目的基本信息", category: "项目管理", method: "PATCH", params: { id: { type: "string", required: true, description: "项目 ID" }, data: { type: "object", required: true, description: "更新字段" } } },
  { name: "删除项目", description: "根据 ID 删除指定项目", category: "项目管理", method: "DELETE", params: { id: { type: "string", required: true, description: "项目 ID" } } },

  // 商品分析
  { name: "AI分析商品", description: "使用 AI 分析商品图片并提取结构化数据", category: "商品分析", method: "POST", params: { id: { type: "string", required: true, description: "项目 ID" }, modelId: { type: "string", required: false, description: "模型 ID" } } },
  { name: "更新分析结果", description: "更新商品的 AI 分析结果", category: "商品分析", method: "PATCH", params: { id: { type: "string", required: true, description: "项目 ID" }, normalizedResult: { type: "object", required: true, description: "标准化分析结果" } } },

  // AI 规划
  { name: "AI规划详情页", description: "使用 AI 规划商品详情页的模块结构", category: "AI 规划", method: "POST", params: { id: { type: "string", required: true, description: "项目 ID" }, options: { type: "object", required: false, description: "规划选项" } } },
  { name: "初始化自定义模块", description: "为项目初始化自定义内容模块", category: "AI 规划", method: "POST", params: { id: { type: "string", required: true, description: "项目 ID" } } },

  // 模块管理
  { name: "列出所有模块", description: "获取指定项目的所有模块列表", category: "模块管理", method: "GET", params: { projectId: { type: "string", required: true, description: "项目 ID" } } },
  { name: "创建模块", description: "为项目创建新的内容模块", category: "模块管理", method: "POST", params: { projectId: { type: "string", required: true, description: "项目 ID" }, data: { type: "object", required: true, description: "模块数据" } } },
  { name: "更新模块", description: "更新模块的内容和配置", category: "模块管理", method: "PATCH", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" }, data: { type: "object", required: true, description: "更新字段" } } },
  { name: "删除模块", description: "删除指定的模块", category: "模块管理", method: "DELETE", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" } } },
  { name: "排序模块", description: "调整项目中模块的排列顺序", category: "模块管理", method: "POST", params: { projectId: { type: "string", required: true, description: "项目 ID" }, orderedSectionIds: { type: "array", required: true, description: "排序后的模块 ID 数组" } } },

  // 图片生成
  { name: "生成模块图片", description: "为模块生成 AI 图片", category: "图片生成", method: "POST", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" }, modelId: { type: "string", required: false, description: "模型 ID" }, referenceAssetIds: { type: "array", required: false, description: "参考素材 ID" } } },
  { name: "重新生成图片", description: "重新为模块生成 AI 图片", category: "图片生成", method: "POST", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" }, options: { type: "object", required: false, description: "生成选项" } } },
  { name: "精修图片", description: "对模块图片进行精修处理", category: "图片生成", method: "POST", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" }, options: { type: "object", required: true, description: "精修选项" } } },
  { name: "编辑图片", description: "对模块图片进行编辑处理", category: "图片生成", method: "POST", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" }, options: { type: "object", required: false, description: "编辑选项" } } },
  { name: "图片微调", description: "对图片进行微调处理", category: "图片生成", method: "POST", params: { data: { type: "object", required: true, description: "微调参数" } } },

  // 版本管理
  { name: "列出版本历史", description: "获取模块的所有版本历史", category: "版本管理", method: "GET", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" } } },
  { name: "激活版本", description: "激活模块的指定历史版本", category: "版本管理", method: "PATCH", params: { projectId: { type: "string", required: true, description: "项目 ID" }, sectionId: { type: "string", required: true, description: "模块 ID" }, versionId: { type: "string", required: true, description: "版本 ID" } } },

  // 素材管理
  { name: "上传素材", description: "上传新的素材文件", category: "素材管理", method: "POST", params: { projectId: { type: "string", required: true, description: "项目 ID" }, data: { type: "object", required: true, description: "素材数据" } } },
  { name: "删除素材", description: "删除指定的素材文件", category: "素材管理", method: "DELETE", params: { id: { type: "string", required: true, description: "素材 ID" } } },
  { name: "设为主图", description: "将素材设为项目主图", category: "素材管理", method: "PATCH", params: { id: { type: "string", required: true, description: "素材 ID" } } },
  { name: "导出项目JSON", description: "将项目导出为 JSON 格式", category: "素材管理", method: "GET", params: { id: { type: "string", required: true, description: "项目 ID" } } },
  { name: "导出项目图片包", description: "将项目图片打包导出", category: "素材管理", method: "GET", params: { id: { type: "string", required: true, description: "项目 ID" } } },

  // 图片知识库
  { name: "列出知识库图片", description: "获取知识库中的图片列表", category: "图片知识库", method: "GET", params: { query: { type: "string", required: false, description: "搜索关键词" }, categoryId: { type: "string", required: false, description: "分类 ID" }, page: { type: "number", required: false, description: "页码" }, pageSize: { type: "number", required: false, description: "每页数量" } } },
  { name: "获取知识库图片详情", description: "获取知识库中单张图片的详情", category: "图片知识库", method: "GET", params: { id: { type: "string", required: true, description: "图片 ID" } } },
  { name: "更新知识库图片", description: "更新知识库图片的元数据", category: "图片知识库", method: "PATCH", params: { id: { type: "string", required: true, description: "图片 ID" }, data: { type: "object", required: true, description: "更新字段" } } },
  { name: "删除知识库图片", description: "删除知识库中的图片", category: "图片知识库", method: "DELETE", params: { id: { type: "string", required: true, description: "图片 ID" } } },
  { name: "获取知识库统计", description: "获取知识库的统计数据", category: "图片知识库", method: "GET", params: {} },
  { name: "列出图片分类", description: "获取知识库的所有图片分类", category: "图片知识库", method: "GET", params: {} },
  { name: "创建图片分类", description: "创建新的图片分类", category: "图片知识库", method: "POST", params: { data: { type: "object", required: true, description: "分类数据" } } },
  { name: "更新图片分类", description: "更新图片分类信息", category: "图片知识库", method: "PATCH", params: { id: { type: "string", required: true, description: "分类 ID" }, data: { type: "object", required: true, description: "更新字段" } } },
  { name: "删除图片分类", description: "删除指定的图片分类", category: "图片知识库", method: "DELETE", params: { id: { type: "string", required: true, description: "分类 ID" } } },
  { name: "列出图片标签", description: "获取知识库的所有图片标签", category: "图片知识库", method: "GET", params: {} },
  { name: "创建图片标签", description: "创建新的图片标签", category: "图片知识库", method: "POST", params: { data: { type: "object", required: true, description: "标签数据" } } },
  { name: "更新图片标签", description: "更新图片标签信息", category: "图片知识库", method: "PATCH", params: { id: { type: "string", required: true, description: "标签 ID" }, data: { type: "object", required: true, description: "更新字段" } } },
  { name: "删除图片标签", description: "删除指定的图片标签", category: "图片知识库", method: "DELETE", params: { id: { type: "string", required: true, description: "标签 ID" } } },
  { name: "列出图片合集", description: "获取知识库的所有图片合集", category: "图片知识库", method: "GET", params: {} },
  { name: "创建图片合集", description: "创建新的图片合集", category: "图片知识库", method: "POST", params: { data: { type: "object", required: true, description: "合集数据" } } },
  { name: "获取图片合集详情", description: "获取图片合集的详细信息", category: "图片知识库", method: "GET", params: { id: { type: "string", required: true, description: "合集 ID" } } },
  { name: "更新图片合集", description: "更新图片合集信息", category: "图片知识库", method: "PATCH", params: { id: { type: "string", required: true, description: "合集 ID" }, data: { type: "object", required: true, description: "更新字段" }, action: { type: "string", required: false, description: "操作类型" } } },
  { name: "删除图片合集", description: "删除指定的图片合集", category: "图片知识库", method: "DELETE", params: { id: { type: "string", required: true, description: "合集 ID" } } },

  // AI 学习系统
  { name: "列出学习会话", description: "获取所有 AI 学习会话", category: "AI 学习", method: "GET", params: { sessionId: { type: "string", required: false, description: "会话 ID" }, stats: { type: "boolean", required: false, description: "返回统计" } } },
  { name: "创建学习会话", description: "创建新的 AI 学习会话", category: "AI 学习", method: "POST", params: { name: { type: "string", required: true, description: "会话名称" }, description: { type: "string", required: false, description: "描述" }, autoApply: { type: "boolean", required: false, description: "自动应用" } } },
  { name: "更新学习会话", description: "更新学习会话信息", category: "AI 学习", method: "PATCH", params: { sessionId: { type: "string", required: true, description: "会话 ID" }, data: { type: "object", required: true, description: "更新字段" } } },
  { name: "删除学习会话", description: "删除指定的学习会话", category: "AI 学习", method: "DELETE", params: { sessionId: { type: "string", required: true, description: "会话 ID" } } },
  { name: "获取分类学习", description: "获取指定分类的学习状态", category: "AI 学习", method: "GET", params: { category: { type: "string", required: true, description: "分类 (hero/detail)" } } },
  { name: "控制学习过程", description: "启动、停止或重试学习过程", category: "AI 学习", method: "POST", params: { category: { type: "string", required: true, description: "分类 (hero/detail)" }, action: { type: "string", required: false, description: "操作 (start/stop/retry)" } } },
  { name: "审查学习结果", description: "审批或拒绝 AI 学习结果", category: "AI 学习", method: "PATCH", params: { category: { type: "string", required: true, description: "分类" }, action: { type: "string", required: true, description: "approve/reject" }, approvedKnowledgeIds: { type: "array", required: false, description: "批准的知识 ID" }, rejectReason: { type: "string", required: false, description: "拒绝原因" } } },
  { name: "列出知识条目", description: "获取所有知识条目列表", category: "AI 学习", method: "GET", params: { sessionId: { type: "string", required: false, description: "会话 ID" }, type: { type: "string", required: false, description: "知识类型" }, stats: { type: "boolean", required: false, description: "返回统计" } } },
  { name: "切换知识状态", description: "启用或禁用指定知识条目", category: "AI 学习", method: "PATCH", params: { knowledgeId: { type: "string", required: true, description: "知识 ID" }, isActive: { type: "boolean", required: true, description: "是否启用" } } },

  // AI 提供商
  { name: "列出AI提供商", description: "获取所有已配置的 AI 服务提供商", category: "AI 提供商", method: "GET", params: {} },
  { name: "保存AI提供商", description: "保存或更新 AI 提供商配置", category: "AI 提供商", method: "POST", params: { data: { type: "object", required: true, description: "提供商配置" } } },
  { name: "激活AI提供商", description: "激活指定的 AI 提供商", category: "AI 提供商", method: "PATCH", params: { providerId: { type: "string", required: true, description: "提供商 ID" } } },
  { name: "测试提供商连接", description: "测试 AI 提供商的连接状态", category: "AI 提供商", method: "POST", params: { data: { type: "object", required: true, description: "连接信息" } } },
  { name: "发现可用模型", description: "发现提供商的可用 AI 模型", category: "AI 提供商", method: "POST", params: { data: { type: "object", required: true, description: "提供商信息" } } },
  { name: "检测模型能力", description: "检测 AI 模型的功能能力", category: "AI 提供商", method: "POST", params: { data: { type: "object", required: true, description: "模型信息" } } },

  // 系统管理
  { name: "获取知识约束配置", description: "获取系统的知识约束配置", category: "系统管理", method: "GET", params: {} },
  { name: "更新知识约束配置", description: "更新系统的知识约束配置", category: "系统管理", method: "POST", params: { data: { type: "object", required: true, description: "约束配置" } } },
  { name: "获取API用量统计", description: "获取 API 接口的使用统计", category: "系统管理", method: "GET", params: { hours: { type: "number", required: false, description: "查询小时数" }, limit: { type: "number", required: false, description: "每页数量" }, page: { type: "number", required: false, description: "页码" } } },
  { name: "查询任务状态", description: "查询异步任务的执行状态", category: "系统管理", method: "GET", params: { taskId: { type: "string", required: true, description: "任务 ID" } } },
];

// 分类配置
const CATEGORIES = [
  { name: "项目管理", icon: FolderKanban, color: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" },
  { name: "商品分析", icon: Search, color: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" },
  { name: "AI 规划", icon: Zap, color: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" },
  { name: "模块管理", icon: Layers, color: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" },
  { name: "图片生成", icon: Image, color: "bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400" },
  { name: "版本管理", icon: FileJson, color: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400" },
  { name: "素材管理", icon: Upload, color: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" },
  { name: "图片知识库", icon: BookOpen, color: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" },
  { name: "AI 学习", icon: Brain, color: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" },
  { name: "AI 提供商", icon: Settings, color: "bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400" },
  { name: "系统管理", icon: BarChart3, color: "bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400" },
];

// 方法颜色
const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  POST: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  PATCH: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  DELETE: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
};

export function MCPDashboard() {
  // 服务器配置状态
  const [serverUrl, setServerUrl] = useState("http://localhost:3001");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "disconnected" | "checking">("idle");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // 工具调用状态
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [requestBody, setRequestBody] = useState("{}");
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [callCount, setCallCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // 生成随机 API Key
  const generateApiKey = useCallback(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "mcp_";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApiKey(result);
    toast.success("API Key 已生成");
  }, []);

  // 检查连接状态
  const checkConnection = useCallback(async () => {
    setConnectionStatus("checking");
    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: "GET",
        headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        setConnectionStatus("connected");
        setLastChecked(new Date());
        toast.success("连接成功");
      } else {
        setConnectionStatus("disconnected");
        toast.error("连接失败", { description: `状态码: ${response.status}` });
      }
    } catch (error) {
      setConnectionStatus("disconnected");
      toast.error("连接失败", { description: "无法连接到 MCP 服务器" });
    }
  }, [serverUrl, apiKey]);

  // 复制到剪贴板
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("已复制到剪贴板");
    } catch (error) {
      toast.error("复制失败");
    }
  }, []);

  // 过滤工具
  const filteredTools = MCP_TOOLS.filter(tool => {
    const matchesSearch = !searchQuery || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // 选择工具
  const handleSelectTool = useCallback((tool: MCPTool) => {
    setSelectedTool(tool);
    setResponse(null);
    
    // 生成默认请求体
    const defaultParams: Record<string, any> = {};
    Object.entries(tool.params).forEach(([key, param]) => {
      if (param.required) {
        if (param.type === "string") defaultParams[key] = "";
        else if (param.type === "number") defaultParams[key] = 0;
        else if (param.type === "boolean") defaultParams[key] = false;
        else if (param.type === "array") defaultParams[key] = [];
        else if (param.type === "object") defaultParams[key] = {};
      }
    });
    setRequestBody(JSON.stringify(defaultParams, null, 2));
  }, []);

  // 调用工具
  const handleCallTool = useCallback(async () => {
    if (!selectedTool) return;
    
    setIsLoading(true);
    setResponse(null);
    
    try {
      const args = JSON.parse(requestBody);
      
      // 构建请求头
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      };
      
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      
      // 调用 MCP 服务器
      const mcpResponse = await fetch(`${serverUrl}/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: selectedTool.name,
            arguments: args,
          },
        }),
      });
      
      const text = await mcpResponse.text();
      
      // 解析 MCP 响应
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/data: (.+)/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error("无法解析响应");
        }
      }
      
      // 提取结果
      if (data.result) {
        const content = data.result.content || [];
        const textContent = content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");
        
        try {
          setResponse(JSON.parse(textContent));
        } catch {
          setResponse({ result: textContent });
        }
      } else if (data.error) {
        setResponse({ error: data.error.message || "工具调用失败" });
      } else {
        setResponse(data);
      }
      
      setCallCount(prev => prev + 1);
      toast.success("工具调用完成");
    } catch (error) {
      setResponse({ error: String(error) });
      toast.error("请求失败", { description: String(error) });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTool, requestBody, serverUrl, apiKey]);

  // 重置请求体
  const handleReset = useCallback(() => {
    if (selectedTool) {
      handleSelectTool(selectedTool);
    }
  }, [selectedTool, handleSelectTool]);

  return (
    <div className="space-y-6">
      {/* 头部统计 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MCP 工具管理</h1>
          <p className="text-muted-foreground">
            共 {MCP_TOOLS.length} 个工具 · {CATEGORIES.length} 个分类
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Zap className="h-3 w-3" />
            已调用 {callCount} 次
          </Badge>
        </div>
      </div>

      {/* 服务器配置面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            MCP 服务器配置
          </CardTitle>
          <CardDescription>
            配置 MCP 服务器连接参数和鉴权信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* 服务器 URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                服务器地址
              </label>
              <div className="flex gap-2">
                <Input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:3001"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={checkConnection} className="px-3">
                  <RefreshCw className={cn("h-4 w-4", connectionStatus === "checking" && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="可选：输入或生成 API Key"
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="outline" onClick={generateApiKey}>
                  <Key className="mr-2 h-4 w-4" />
                  生成
                </Button>
              </div>
            </div>

            {/* 连接状态 */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                连接状态
              </label>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                {connectionStatus === "idle" ? (
                  <>
                    <WifiOff className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-500">未测试</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      点击测试连接
                    </span>
                  </>
                ) : connectionStatus === "connected" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Wifi className="h-5 w-5 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">已连接</span>
                    </div>
                    {lastChecked && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {lastChecked.toLocaleTimeString()}
                      </span>
                    )}
                  </>
                ) : connectionStatus === "checking" ? (
                  <>
                    <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                    <span className="text-sm font-medium text-amber-600">测试中...</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-medium text-red-600">连接失败</span>
                    {lastChecked && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {lastChecked.toLocaleTimeString()}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 生成的请求 URL */}
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              MCP 请求 URL
            </label>
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50 font-mono text-sm">
              <code className="flex-1 break-all">{`${serverUrl}/mcp`}</code>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-3"
                onClick={() => handleCopy(`${serverUrl}/mcp`)}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Claude Desktop 配置示例 */}
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">Claude Desktop 配置示例</label>
            <div className="relative">
              <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs overflow-x-auto">
                <code>{`{
  "mcpServers": {
    "ximo-mall": {
      "command": "npx",
      "args": ["tsx", "path/to/mcp-server/src/index.ts"],
      "env": {
        "XIMO_MALL_API_URL": "${serverUrl.replace('/mcp', '')}"
      }
    }
  }
}`}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 px-3"
                onClick={() => handleCopy(`{
  "mcpServers": {
    "ximo-mall": {
      "command": "npx",
      "args": ["tsx", "path/to/mcp-server/src/index.ts"],
      "env": {
        "XIMO_MALL_API_URL": "${serverUrl.replace('/mcp', '')}"
      }
    }
  }
}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* 左侧：工具列表 */}
        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索工具..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 分类筛选 */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              全部
            </Button>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const count = MCP_TOOLS.filter(t => t.category === cat.name).length;
              return (
                <Button
                  key={cat.name}
                  variant={selectedCategory === cat.name ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.name)}
                  className="gap-1"
                >
                  <Icon className="h-3 w-3" />
                  {cat.name}
                  <span className="text-xs opacity-60">({count})</span>
                </Button>
              );
            })}
          </div>

          {/* 工具列表 */}
          <Card className="max-h-[600px] overflow-y-auto">
            <CardContent className="p-2">
              <div className="space-y-1">
                {filteredTools.map(tool => {
                  const category = CATEGORIES.find(c => c.name === tool.category);
                  const Icon = category?.icon || Zap;
                  const isSelected = selectedTool?.name === tool.name;
                  
                  return (
                    <button
                      key={tool.name}
                      onClick={() => handleSelectTool(tool)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-all",
                        "hover:bg-muted/50",
                        isSelected && "bg-muted shadow-sm"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn("shrink-0 text-[10px] font-mono", METHOD_COLORS[tool.method])}
                        >
                          {tool.method}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{tool.description}</div>
                          <div className="truncate text-xs text-muted-foreground font-mono">{tool.name}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                
                {filteredTools.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    未找到匹配的工具
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：工具详情 */}
        <div className="space-y-4">
          {selectedTool ? (
            <>
              {/* 工具信息 */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Badge className={METHOD_COLORS[selectedTool.method]}>
                          {selectedTool.method}
                        </Badge>
                        {selectedTool.description}
                      </CardTitle>
                      <CardDescription className="mt-1 font-mono">
                        {selectedTool.name}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{selectedTool.category}</Badge>
                  </div>
                </CardHeader>
                
                {/* 参数列表 */}
                {Object.keys(selectedTool.params).length > 0 && (
                  <CardContent>
                    <div className="text-sm font-medium mb-3">参数</div>
                    <div className="rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-3 py-2 text-left font-medium">参数名</th>
                            <th className="px-3 py-2 text-left font-medium">类型</th>
                            <th className="px-3 py-2 text-left font-medium">必填</th>
                            <th className="px-3 py-2 text-left font-medium">说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedTool.params).map(([key, param]) => (
                            <tr key={key} className="border-b last:border-0">
                              <td className="px-3 py-2 font-mono text-xs">{key}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="text-xs">
                                  {param.type}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                {param.required ? (
                                  <span className="text-red-500 text-xs font-medium">必填</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">可选</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* 请求编辑器 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">请求参数</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="mr-1 h-3 w-3" />
                        重置
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleCallTool}
                        disabled={isLoading || connectionStatus !== "connected"}
                      >
                        {isLoading ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-3 w-3" />
                        )}
                        调用工具
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder="输入 JSON 请求参数..."
                    className="min-h-[150px] font-mono text-sm"
                  />
                </CardContent>
              </Card>

              {/* 响应结果 */}
              {response && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {response.error ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        响应结果
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(JSON.stringify(response, null, 2))}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="rounded-lg bg-muted p-4 overflow-auto max-h-[400px] text-sm">
                      <code>{JSON.stringify(response, null, 2)}</code>
                    </pre>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* 未选择工具时的占位 */
            <Card className="flex min-h-[400px] items-center justify-center">
              <CardContent className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Zap className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle className="mb-2">选择一个工具</CardTitle>
                <CardDescription>
                  从左侧列表选择一个 MCP 工具来查看详情和调用
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
