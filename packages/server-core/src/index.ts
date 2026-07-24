import type { Product, Scan } from "@skincause/contracts";
import { products, scans, seededExperiment } from "@skincause/domain";

export interface SkinAnalysisProvider {
  createAnalysis(input: {
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    requestedConcerns: string[];
    idempotencyKey: string;
  }): Promise<{ externalTaskId: string }>;
  getAnalysis(externalTaskId: string): Promise<
    | { status: "queued" | "processing" }
    | { status: "failed"; code: string; message: string; retryable: boolean }
    | { status: "succeeded"; result: Scan }
  >;
}

export class MockSkinAnalysisProvider implements SkinAnalysisProvider {
  private requests = new Map<string, string>();

  async createAnalysis(input: {
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    requestedConcerns: string[];
    idempotencyKey: string;
  }) {
    const existing = this.requests.get(input.idempotencyKey);
    if (existing) return { externalTaskId: existing };
    const externalTaskId = `mock_${input.idempotencyKey}`;
    this.requests.set(input.idempotencyKey, externalTaskId);
    return { externalTaskId };
  }

  async getAnalysis(_externalTaskId: string) {
    return { status: "succeeded" as const, result: scans.at(-1)! };
  }
}

export class YouCamSkinAnalysisProvider implements SkinAnalysisProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://yce-api-01.makeupar.com",
    private readonly apiVersion = "v2.1"
  ) {}

  async createAnalysis(input: {
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    requestedConcerns: string[];
    idempotencyKey: string;
  }) {
    if (!this.apiKey) throw new Error("YOUCAM_API_KEY is required when mock mode is disabled.");

    const fileResponse = await fetch(`${this.baseUrl}/s2s/${this.apiVersion}/file/skin-analysis`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify({ files: [{ content_type: input.mimeType, file_name: "scan" }] })
    });
    if (!fileResponse.ok) throw new Error("YouCam file request failed.");
    const filePayload = (await fileResponse.json()) as {
      data?: { files?: Array<{ file_id: string; requests?: Array<{ url: string; method?: string; headers?: Record<string, string> }> }> };
    };
    const file = filePayload.data?.files?.[0];
    const upload = file?.requests?.[0];
    if (!file?.file_id || !upload?.url) throw new Error("YouCam file schema changed.");

    const uploadResponse = await fetch(upload.url, {
      method: upload.method ?? "PUT",
      headers: upload.headers,
      body: input.image.slice().buffer as ArrayBuffer
    });
    if (!uploadResponse.ok) throw new Error("YouCam upload failed.");

    const taskResponse = await fetch(`${this.baseUrl}/s2s/${this.apiVersion}/task/skin-analysis`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify({ src_file_id: file.file_id, concerns: input.requestedConcerns })
    });
    if (!taskResponse.ok) throw new Error("YouCam task creation failed.");
    const taskPayload = (await taskResponse.json()) as { data?: { task_id?: string } };
    if (!taskPayload.data?.task_id) throw new Error("YouCam task schema changed.");
    return { externalTaskId: taskPayload.data.task_id };
  }

  async getAnalysis(externalTaskId: string) {
    const response = await fetch(
      `${this.baseUrl}/s2s/${this.apiVersion}/task/skin-analysis/${encodeURIComponent(externalTaskId)}`,
      { headers: { authorization: `Bearer ${this.apiKey}` } }
    );
    if (!response.ok) {
      return { status: "failed" as const, code: "PROVIDER_ERROR", message: "Analysis is temporarily unavailable.", retryable: true };
    }
    const payload = (await response.json()) as { data?: { status?: string } };
    if (payload.data?.status !== "success") return { status: "processing" as const };

    // Live payload normalization is deliberately fail-closed until a validated
    // v2.1 fixture is supplied with production credentials.
    return {
      status: "failed" as const,
      code: "PROVIDER_SCHEMA_CHANGED",
      message: "The provider response could not be normalized.",
      retryable: false
    };
  }
}

const createdProducts: Product[] = [];
const uploadSessions = new Map<string, { scanId: string; status: Scan["status"] }>();

export const serverServices = {
  getProfile() {
    return {
      mode: "guest-demo",
      displayName: "Guest investigator",
      minimumSupportedClientVersion: "0.1.0",
      capabilities: ["seeded-demo", "routine", "mock-scan", "experiments", "privacy-export"]
    };
  },
  listProducts() {
    return [...products, ...createdProducts];
  },
  createProduct(product: Product) {
    createdProducts.push(product);
    return product;
  },
  listExperiments() {
    return [seededExperiment];
  },
  getExperiment(id: string) {
    return id === seededExperiment.id ? seededExperiment : null;
  },
  createUploadSession(clientRequestId: string) {
    const existing = uploadSessions.get(clientRequestId);
    if (existing) return existing;
    const scanId = `scan-${clientRequestId}`;
    const session = { scanId, status: "pending_upload" as const };
    uploadSessions.set(clientRequestId, session);
    return session;
  },
  submitScan(scanId: string) {
    const session = [...uploadSessions.values()].find((item) => item.scanId === scanId);
    if (session) session.status = "processing";
    return { scanId, status: "processing" as const, pollAfterMs: 1500 };
  },
  getScan(scanId: string) {
    return { ...scans.at(-1)!, id: scanId };
  }
};

export function success<T>(data: T, requestId = crypto.randomUUID()) {
  return { data, meta: { requestId, apiVersion: "v1" as const } };
}

export function failure(code: string, message: string, retryable = false, requestId = crypto.randomUUID()) {
  return {
    error: { code, message, retryable },
    meta: { requestId, apiVersion: "v1" as const }
  };
}
