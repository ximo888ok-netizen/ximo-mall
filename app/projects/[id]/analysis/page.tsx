import { notFound } from "next/navigation";

import { AnalysisWorkspace } from "@/components/analysis/analysis-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectOutputConfigCard } from "@/components/shared/project-output-config-card";
import { getProjectDetail } from "@/lib/services/project-service";

export default async function ProjectAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    autoRun?: string;
    source?: string;
    analysisErrorCode?: string;
    analysisErrorMessage?: string;
    knowledgeMode?: string;
  }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const project = await getProjectDetail(id);
  if (!project) notFound();
  const analysisErrorCode = resolvedSearchParams?.analysisErrorCode
    ? decodeURIComponent(resolvedSearchParams.analysisErrorCode)
    : undefined;
  const shouldAutoRun =
    resolvedSearchParams?.autoRun === "1" &&
    (!analysisErrorCode || ["PROVIDER_TIMEOUT", "INTERNAL_ERROR", "UNKNOWN_ERROR"].includes(analysisErrorCode));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="分析与配置"
        title={`${project.name} 的项目信息与商品分析`}
        description="这里承接头图上传后的下一步：先完善项目信息，再确认结构化分析结果，最后继续进入页面规划。"
      />
      <ProjectOutputConfigCard project={project} editable />
      <AnalysisWorkspace
        project={project}
        autoRunOnLoad={shouldAutoRun}
        knowledgeMode={resolvedSearchParams?.knowledgeMode === "1"}
        source={resolvedSearchParams?.source}
        initialErrorCode={analysisErrorCode}
        initialNotice={
          resolvedSearchParams?.analysisErrorMessage ? decodeURIComponent(resolvedSearchParams.analysisErrorMessage) : undefined
        }
      />
    </div>
  );
}
