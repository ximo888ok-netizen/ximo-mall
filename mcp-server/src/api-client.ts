/**
 * Ximo Mall API Client
 *
 * HTTP client wrapping all Next.js API routes for the Ximo Mall application.
 * Provides typed methods for every endpoint in the project.
 */

import fetch, { type RequestInit } from "node-fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiClientConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

// Generic query-parameter builder
type QueryParams = Record<string, string | number | boolean | string[] | undefined | null>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryString(params?: QueryParams): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v);
    } else {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function createApiError(status: number, message: string, body: unknown): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.body = body;
  return err;
}

// ---------------------------------------------------------------------------
// ApiClient
// ---------------------------------------------------------------------------

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config?: ApiClientConfig) {
    this.baseUrl = (
      config?.baseUrl ||
      process.env.XIMO_MALL_API_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    this.timeout = config?.timeout ?? 30_000;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: QueryParams;
      headers?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${buildQueryString(options?.query)}`;
    const timeoutMs = options?.timeout ?? this.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    };
    if (options?.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown network error";
      throw createApiError(0, `Network error: ${message}`, null);
    } finally {
      clearTimeout(timer);
    }

    // Attempt to parse JSON regardless of status
    let body: unknown;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await response.json().catch(() => null);
    } else {
      body = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const errMsg =
        (body && typeof body === "object" && "error" in (body as Record<string, unknown>))
          ? String((body as Record<string, unknown>).error)
          : `HTTP ${response.status}: ${response.statusText}`;
      throw createApiError(response.status, errMsg, body);
    }

    return body as T;
  }

  private get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  private post<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("POST", path, { body, query });
  }

  private patch<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("PATCH", path, { body, query });
  }

  private delete<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }

  // =======================================================================
  // Projects
  // =======================================================================

  /** GET /api/projects */
  listProjects(): Promise<unknown> {
    return this.get("/api/projects");
  }

  /** POST /api/projects */
  createProject(data: {
    name: string;
    platform: string;
    style: string;
    description?: string;
  }): Promise<unknown> {
    return this.post("/api/projects", data);
  }

  /** GET /api/projects/{id} */
  getProject(id: string): Promise<unknown> {
    return this.get(`/api/projects/${encodeURIComponent(id)}`);
  }

  /** PATCH /api/projects/{id} */
  updateProject(
    id: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.patch(`/api/projects/${encodeURIComponent(id)}`, data);
  }

  /** DELETE /api/projects/{id} */
  deleteProject(id: string): Promise<unknown> {
    return this.delete(`/api/projects/${encodeURIComponent(id)}`);
  }

  // =======================================================================
  // Analysis
  // =======================================================================

  /** POST /api/projects/{id}/analyze */
  analyzeProject(
    id: string,
    modelId?: string,
  ): Promise<unknown> {
    return this.post(`/api/projects/${encodeURIComponent(id)}/analyze`, {
      modelId,
    });
  }

  /** PATCH /api/projects/{id}/analysis */
  updateAnalysis(
    id: string,
    normalizedResult: Record<string, unknown>,
  ): Promise<unknown> {
    return this.patch(
      `/api/projects/${encodeURIComponent(id)}/analysis`,
      { normalizedResult },
    );
  }

  // =======================================================================
  // Planning
  // =======================================================================

  /** POST /api/projects/{id}/plan-sections */
  planSections(
    id: string,
    options?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(id)}/plan-sections`,
      options ?? {},
    );
  }

  /** POST /api/projects/{id}/init-custom-sections */
  initCustomSections(id: string): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(id)}/init-custom-sections`,
      {},
    );
  }

  // =======================================================================
  // Sections
  // =======================================================================

  /**
   * GET /api/projects/{id}
   * Note: Sections are included in the project detail response.
   * There is no dedicated sections list endpoint; use getProject instead.
   */
  listSections(projectId: string): Promise<unknown> {
    return this.getProject(projectId);
  }

  /** POST /api/projects/{id}/sections */
  createSection(
    projectId: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(projectId)}/sections`,
      data,
    );
  }

  /** PATCH /api/projects/{id}/sections/{sectionId} */
  updateSection(
    projectId: string,
    sectionId: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.patch(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}`,
      data,
    );
  }

  /** DELETE /api/projects/{id}/sections/{sectionId} */
  deleteSection(projectId: string, sectionId: string): Promise<unknown> {
    return this.delete(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}`,
    );
  }

  /** POST /api/projects/{id}/sections/reorder */
  reorderSections(
    projectId: string,
    orderedSectionIds: string[],
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(projectId)}/sections/reorder`,
      { orderedSectionIds },
    );
  }

  // =======================================================================
  // Generation
  // =======================================================================

  /** POST /api/projects/{id}/sections/{sectionId}/generate */
  generateSectionImage(
    projectId: string,
    sectionId: string,
    options?: {
      modelId?: string;
      referenceAssetIds?: string[];
      customMode?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/generate`,
      options ?? {},
    );
  }

  /** POST /api/projects/{id}/sections/{sectionId}/regenerate */
  regenerateSectionImage(
    projectId: string,
    sectionId: string,
    options?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/regenerate`,
      options ?? {},
    );
  }

  /** POST /api/projects/{id}/sections/{sectionId}/refine */
  refineSectionImage(
    projectId: string,
    sectionId: string,
    options: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/refine`,
      options,
    );
  }

  /** POST /api/projects/{id}/sections/{sectionId}/edit */
  editSectionImage(
    projectId: string,
    sectionId: string,
    options?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/edit`,
      options ?? {},
    );
  }

  // =======================================================================
  // Versions
  // =======================================================================

  /** GET /api/projects/{id}/sections/{sectionId}/versions */
  listSectionVersions(
    projectId: string,
    sectionId: string,
  ): Promise<unknown> {
    return this.get(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/versions`,
    );
  }

  /** PATCH /api/projects/{id}/sections/{sectionId}/versions/{versionId}/activate */
  activateVersion(
    projectId: string,
    sectionId: string,
    versionId: string,
  ): Promise<unknown> {
    return this.patch(
      `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/versions/${encodeURIComponent(versionId)}/activate`,
      {},
    );
  }

  // =======================================================================
  // Assets
  // =======================================================================

  /** POST /api/projects/{id}/assets/upload */
  uploadAsset(
    projectId: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/api/projects/${encodeURIComponent(projectId)}/assets/upload`,
      data,
    );
  }

  /** DELETE /api/assets/{id} */
  deleteAsset(id: string): Promise<unknown> {
    return this.delete(`/api/assets/${encodeURIComponent(id)}`);
  }

  /** PATCH /api/assets/{id}/set-main */
  setMainAsset(id: string): Promise<unknown> {
    return this.patch(
      `/api/assets/${encodeURIComponent(id)}/set-main`,
      {},
    );
  }

  // =======================================================================
  // Export
  // =======================================================================

  /** GET /api/projects/{id}/export/json */
  exportProjectJson(id: string): Promise<unknown> {
    return this.get(`/api/projects/${encodeURIComponent(id)}/export/json`);
  }

  /** GET /api/projects/{id}/export/images */
  exportProjectImages(id: string): Promise<unknown> {
    return this.get(`/api/projects/${encodeURIComponent(id)}/export/images`);
  }

  // =======================================================================
  // Library
  // =======================================================================

  /** GET /api/library */
  listLibraryItems(
    params?: {
      query?: string;
      categoryId?: string;
      tagIds?: string[];
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: string;
    },
  ): Promise<unknown> {
    return this.get("/api/library", {
      query: params?.query,
      categoryId: params?.categoryId,
      tagIds: params?.tagIds,
      page: params?.page,
      pageSize: params?.pageSize,
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder,
    });
  }

  /** POST /api/library (multipart/form-data for file upload) */
  uploadLibraryImage(data: {
    fileBuffer: Buffer;
    fileName: string;
    mimeType?: string;
    title?: string;
    description?: string;
    categoryId?: string;
    tagIds?: string[];
    isPublic?: boolean;
  }): Promise<unknown> {
    // Build multipart form data manually for node-fetch
    const boundary = `----BananaMall${Date.now()}`;
    const parts: Buffer[] = [];

    const addField = (name: string, value: string) => {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        ),
      );
    };

    if (data.title) addField("title", data.title);
    if (data.description) addField("description", data.description);
    if (data.categoryId) addField("categoryId", data.categoryId);
    if (data.isPublic !== undefined) addField("isPublic", String(data.isPublic));
    if (data.tagIds) {
      for (const tagId of data.tagIds) {
        addField("tagIds", tagId);
      }
    }

    // File part
    const mimeType = data.mimeType || "application/octet-stream";
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${data.fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
      ),
    );
    parts.push(data.fileBuffer);
    parts.push(Buffer.from("\r\n"));
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    return this.requestWithBody<unknown>(
      "POST",
      "/api/library",
      body,
      `multipart/form-data; boundary=${boundary}`,
    );
  }

  /** Low-level request that sends a raw body buffer */
  private async requestWithBody<T>(
    method: string,
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": contentType,
          Accept: "application/json",
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    let responseBody: unknown;
    const ct = response.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      responseBody = await response.json().catch(() => null);
    } else {
      responseBody = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const errMsg =
        (responseBody &&
          typeof responseBody === "object" &&
          "error" in (responseBody as Record<string, unknown>))
          ? String((responseBody as Record<string, unknown>).error)
          : `HTTP ${response.status}: ${response.statusText}`;
      throw createApiError(response.status, errMsg, responseBody);
    }

    return responseBody as T;
  }

  /** GET /api/library/{id} */
  getLibraryItem(id: string): Promise<unknown> {
    return this.get(`/api/library/${encodeURIComponent(id)}`);
  }

  /** PATCH /api/library/{id} */
  updateLibraryItem(
    id: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.patch(`/api/library/${encodeURIComponent(id)}`, data);
  }

  /** DELETE /api/library/{id} */
  deleteLibraryItem(id: string): Promise<unknown> {
    return this.delete(`/api/library/${encodeURIComponent(id)}`);
  }

  /** GET /api/library/stats */
  getLibraryStats(): Promise<unknown> {
    return this.get("/api/library/stats");
  }

  // -- Categories --

  /** GET /api/library/categories */
  listCategories(): Promise<unknown> {
    return this.get("/api/library/categories");
  }

  /** POST /api/library/categories */
  createCategory(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/library/categories", data);
  }

  /** PATCH /api/library/categories/{id} */
  updateCategory(
    id: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.patch(
      `/api/library/categories/${encodeURIComponent(id)}`,
      data,
    );
  }

  /** DELETE /api/library/categories/{id} */
  deleteCategory(id: string): Promise<unknown> {
    return this.delete(`/api/library/categories/${encodeURIComponent(id)}`);
  }

  // -- Tags --

  /** GET /api/library/tags */
  listTags(): Promise<unknown> {
    return this.get("/api/library/tags");
  }

  /** POST /api/library/tags */
  createTag(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/library/tags", data);
  }

  /** PATCH /api/library/tags/{id} */
  updateTag(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.patch(`/api/library/tags/${encodeURIComponent(id)}`, data);
  }

  /** DELETE /api/library/tags/{id} */
  deleteTag(id: string): Promise<unknown> {
    return this.delete(`/api/library/tags/${encodeURIComponent(id)}`);
  }

  // -- Collections --

  /** GET /api/library/collections */
  listCollections(): Promise<unknown> {
    return this.get("/api/library/collections");
  }

  /** POST /api/library/collections */
  createCollection(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/library/collections", data);
  }

  /** GET /api/library/collections/{id} */
  getCollection(id: string): Promise<unknown> {
    return this.get(
      `/api/library/collections/${encodeURIComponent(id)}`,
    );
  }

  /** PATCH /api/library/collections/{id} */
  updateCollection(
    id: string,
    data: Record<string, unknown>,
    action?: string,
  ): Promise<unknown> {
    const body = action ? { ...data, action } : data;
    return this.patch(
      `/api/library/collections/${encodeURIComponent(id)}`,
      body,
    );
  }

  /** DELETE /api/library/collections/{id} */
  deleteCollection(id: string): Promise<unknown> {
    return this.delete(
      `/api/library/collections/${encodeURIComponent(id)}`,
    );
  }

  // =======================================================================
  // Learning
  // =======================================================================

  /** GET /api/learning */
  listLearningSessions(
    params?: { sessionId?: string; stats?: boolean },
  ): Promise<unknown> {
    return this.get("/api/learning", {
      sessionId: params?.sessionId,
      stats: params?.stats,
    });
  }

  /** POST /api/learning */
  createLearningSession(data: {
    name: string;
    description?: string;
    autoApply?: boolean;
  }): Promise<unknown> {
    return this.post("/api/learning", data);
  }

  /** PATCH /api/learning */
  updateLearningSession(
    sessionId: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.patch("/api/learning", { sessionId, ...data });
  }

  /** DELETE /api/learning?sessionId={sessionId} */
  deleteLearningSession(sessionId: string): Promise<unknown> {
    return this.delete("/api/learning", { sessionId });
  }

  /** GET /api/learning/category/{category} */
  getCategorySession(category: string): Promise<unknown> {
    return this.get(
      `/api/learning/category/${encodeURIComponent(category)}`,
    );
  }

  /** POST /api/learning/category/{category}?action={action} */
  startLearning(
    category: string,
    action?: string,
  ): Promise<unknown> {
    return this.post(
      `/api/learning/category/${encodeURIComponent(category)}`,
      {},
      { action: action ?? "start" },
    );
  }

  /** PATCH /api/learning/category/{category} */
  reviewLearning(
    category: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    return this.patch(
      `/api/learning/category/${encodeURIComponent(category)}`,
      data,
    );
  }

  /** GET /api/learning/knowledges */
  listKnowledges(
    params?: {
      sessionId?: string;
      type?: string;
      stats?: boolean;
    },
  ): Promise<unknown> {
    return this.get("/api/learning/knowledges", {
      sessionId: params?.sessionId,
      type: params?.type,
      stats: params?.stats,
    });
  }

  /** PATCH /api/learning/knowledges */
  toggleKnowledge(
    knowledgeId: string,
    isActive: boolean,
  ): Promise<unknown> {
    return this.patch("/api/learning/knowledges", {
      knowledgeId,
      isActive,
    });
  }

  // =======================================================================
  // Providers
  // =======================================================================

  /** GET /api/providers */
  listProviders(): Promise<unknown> {
    return this.get("/api/providers");
  }

  /** POST /api/providers */
  saveProvider(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/providers", data);
  }

  /** PATCH /api/providers */
  activateProvider(providerId: string): Promise<unknown> {
    return this.patch("/api/providers", { providerId });
  }

  /** POST /api/providers/test */
  testProvider(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/providers/test", data);
  }

  /** POST /api/providers/discover-models */
  discoverModels(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/providers/discover-models", data);
  }

  /** POST /api/providers/detect-capabilities */
  detectCapabilities(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/providers/detect-capabilities", data);
  }

  // =======================================================================
  // Knowledge Constraints
  // =======================================================================

  /** GET /api/knowledge/constraints */
  getConstraints(): Promise<unknown> {
    return this.get("/api/knowledge/constraints");
  }

  /** POST /api/knowledge/constraints */
  updateConstraints(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/knowledge/constraints", data);
  }

  // =======================================================================
  // Image Tune
  // =======================================================================

  /** POST /api/image-tune */
  tuneImage(data: Record<string, unknown>): Promise<unknown> {
    return this.post("/api/image-tune", data);
  }

  // =======================================================================
  // Monitoring
  // =======================================================================

  /** GET /api/monitor/usage */
  getUsageStats(
    params?: {
      hours?: number;
      limit?: number;
      page?: number;
      projectId?: string;
      category?: string;
      quotaState?: string;
      success?: string;
    },
  ): Promise<unknown> {
    return this.get("/api/monitor/usage", {
      hours: params?.hours,
      limit: params?.limit,
      page: params?.page,
      projectId: params?.projectId,
      category: params?.category,
      quotaState: params?.quotaState,
      success: params?.success,
    });
  }

  // =======================================================================
  // Tasks
  // =======================================================================

  /** GET /api/tasks/{taskId} */
  getTaskStatus(taskId: string): Promise<unknown> {
    return this.get(`/api/tasks/${encodeURIComponent(taskId)}`);
  }
}
