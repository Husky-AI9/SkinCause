import type { Product, Scan, ScanActivityEvent } from "@skincause/contracts";
import { products, scans, seededExperiment } from "@skincause/domain";
import { scanActivity } from "./scan-activity";
import {
  ROUTINE_SD_PROFILE_VERSION,
  concernDefinitionForAction,
  resolveRoutineSdActions
} from "./skin-analysis-profile";
import {
  firstSafeMaskUrl,
  youCamCreateTaskResponseSchema,
  youCamFileResponseSchema,
  youCamTaskStatusSchema
} from "./youcam-schemas";
import { validateSdImageDimensions } from "./image-dimensions";
import { safeProviderFailure } from "./provider-errors";

export * from "./skin-analysis-profile";

export interface SkinAnalysisProvider {
  readonly providerName: "mock" | "youcam";
  createAnalysis(input: {
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    requestedConcerns: string[];
    idempotencyKey: string;
    captureSource?: "upload" | "camera-kit";
  }): Promise<{ externalTaskId: string; activity: ScanActivityEvent[] }>;
  getAnalysis(externalTaskId: string): Promise<
    | { status: "queued" | "processing"; activity: ScanActivityEvent[] }
    | { status: "failed"; code: string; message: string; retryable: boolean; activity: ScanActivityEvent[] }
    | { status: "succeeded"; result: Scan; activity: ScanActivityEvent[] }
  >;
}

export class MockSkinAnalysisProvider implements SkinAnalysisProvider {
  readonly providerName = "mock" as const;
  private requests = new Map<string, string>();

  async createAnalysis(input: {
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    requestedConcerns: string[];
    idempotencyKey: string;
    captureSource?: "upload" | "camera-kit";
  }) {
    const existing = this.requests.get(input.idempotencyKey);
    if (existing) {
      return {
        externalTaskId: existing,
        activity: [scanActivity("mock", "idempotent agent test task reused", "success")]
      };
    }
    const externalTaskId = `mock_${input.idempotencyKey}`;
    this.requests.set(input.idempotencyKey, externalTaskId);
    return {
      externalTaskId,
      activity: [scanActivity("mock", "deterministic test task created", "success")]
    };
  }

  async getAnalysis(_externalTaskId: string) {
    const result = scans.at(-1)!;
    const scores = result.concerns
      .map((concern) => `${concern.key}=${concern.normalizedSeverity ?? "n/a"}`)
      .join(" ");
    return {
      status: "succeeded" as const,
      result,
      activity: [
        scanActivity("mock", "deterministic test task completed", "success"),
        scanActivity("mock", `test output normalized: ${scores}`, "success")
      ]
    };
  }
}

export class YouCamSkinAnalysisProvider implements SkinAnalysisProvider {
  readonly providerName = "youcam" as const;

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
    captureSource?: "upload" | "camera-kit";
  }) {
    if (!this.apiKey) throw new Error("YOUCAM_API_KEY is required when mock mode is disabled.");
    const requestedConcerns = resolveRoutineSdActions(input.requestedConcerns);
    validateSdImageDimensions(input.image, input.mimeType);

    const activity: ScanActivityEvent[] = [];
    const fileExtension = input.mimeType === "image/png" ? "png" : "jpg";
    const fileResponse = await fetch(`${this.baseUrl}/s2s/${this.apiVersion}/file/skin-analysis`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify({
        files: [
          {
            content_type: input.mimeType,
            file_name: `scan.${fileExtension}`,
            file_size: input.image.byteLength
          }
        ]
      })
    });
    if (!fileResponse.ok) throw new Error("PROVIDER_FILE_REQUEST_FAILED");
    activity.push(scanActivity(
      "youcam",
      `POST /s2s/${this.apiVersion}/file/skin-analysis -> ${fileResponse.status}; upload slot received`,
      "success"
    ));
    const filePayload = youCamFileResponseSchema.safeParse(await fileResponse.json());
    if (!filePayload.success) throw new Error("PROVIDER_FILE_SCHEMA_CHANGED");
    const file = filePayload.data.data.files[0];
    const upload = file.requests[0];

    const uploadResponse = await fetch(upload.url, {
      method: upload.method ?? "PUT",
      headers: upload.headers,
      body: input.image.slice().buffer as ArrayBuffer
    });
    if (!uploadResponse.ok) throw new Error("PROVIDER_UPLOAD_FAILED");
    activity.push(scanActivity(
      "youcam",
      `PUT signed provider upload -> ${uploadResponse.status}; ${input.image.byteLength} bytes accepted`,
      "success"
    ));

    const taskResponse = await fetch(`${this.baseUrl}/s2s/${this.apiVersion}/task/skin-analysis`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify({
        src_file_id: file.file_id,
        dst_actions: requestedConcerns,
        miniserver_args: {
          enable_mask_overlay: true
        },
        format: "json",
        pf_camera_kit: input.captureSource === "camera-kit"
      })
    });
    if (!taskResponse.ok) throw new Error("PROVIDER_TASK_REQUEST_FAILED");
    activity.push(scanActivity(
      "youcam",
      `POST /s2s/${this.apiVersion}/task/skin-analysis -> ${taskResponse.status}; analysis task accepted`,
      "success"
    ));
    const taskPayload = youCamCreateTaskResponseSchema.safeParse(await taskResponse.json());
    if (!taskPayload.success) throw new Error("PROVIDER_TASK_SCHEMA_CHANGED");
    return { externalTaskId: taskPayload.data.data.task_id, activity };
  }

  async getAnalysis(externalTaskId: string) {
    const response = await fetch(
      `${this.baseUrl}/s2s/${this.apiVersion}/task/skin-analysis/${encodeURIComponent(externalTaskId)}`,
      { headers: { authorization: `Bearer ${this.apiKey}` } }
    );
    const activity: ScanActivityEvent[] = [
      scanActivity(
        "youcam",
        `GET /s2s/${this.apiVersion}/task/skin-analysis/:task_id -> ${response.status}`,
        response.ok ? "info" : "error"
      )
    ];
    if (!response.ok) {
      return {
        status: "failed" as const,
        code: "PROVIDER_ERROR",
        message: "Analysis is temporarily unavailable.",
        retryable: true,
        activity
      };
    }
    const parsedPayload = youCamTaskStatusSchema.safeParse(await response.json());
    if (!parsedPayload.success) {
      return {
        status: "failed" as const,
        code: "PROVIDER_SCHEMA_CHANGED",
        message: "The provider response could not be normalized.",
        retryable: false,
        activity
      };
    }
    const payload = parsedPayload.data;
    const taskStatus = payload.data.task_status;
    activity.push(scanActivity(
      "youcam",
      `provider status=${taskStatus ?? "unknown"}`,
      taskStatus === "error" ? "error" : taskStatus === "success" ? "success" : "info"
    ));
    if (taskStatus === "error") {
      const failure = safeProviderFailure(payload.data.error_code ?? undefined);
      return {
        status: "failed" as const,
        ...failure,
        activity
      };
    }
    if (taskStatus !== "success") return { status: "processing" as const, activity };

    const output = payload.data.results?.output;
    if (!Array.isArray(output)) {
      return {
        status: "failed" as const,
        code: "PROVIDER_SCHEMA_CHANGED",
        message: "The provider response could not be normalized.",
        retryable: false,
        activity
      };
    }

    const concerns = output.flatMap((item) => {
      const definition = concernDefinitionForAction(item.type);
      if (!definition) return [];
      const rawScore = typeof item.raw_score === "number" ? item.raw_score : null;
      const uiScore = typeof item.ui_score === "number" ? item.ui_score : null;
      const maskUrl = firstSafeMaskUrl(item.mask_urls);
      return [{
        key: definition.key,
        providerLabel: definition.providerLabel,
        displayLabel: definition.displayLabel,
        rawScore,
        uiScore,
        normalizedSeverity: rawScore === null ? null : Math.max(0, Math.min(100, 100 - rawScore)),
        directionSource: "provider-doc" as const,
        experimentRole: definition.experimentRole,
        ...(maskUrl ? { maskUrl } : {})
      }];
    });
    const concernOrder = new Map([["pores", 0], ["texture", 1], ["redness", 2]]);
    const scores = [...concerns]
      .sort((left, right) => (concernOrder.get(left.key) ?? 99) - (concernOrder.get(right.key) ?? 99))
      .map((concern) => `${concern.key}=${concern.normalizedSeverity === null ? "n/a" : Math.round(concern.normalizedSeverity)}`)
      .join(" ");
    const maskCount = concerns.filter((concern) => concern.maskUrl).length;
    activity.push(scanActivity(
      "youcam",
      `response normalized: ${scores}; masks=${maskCount}`,
      "success"
    ));

    return {
      status: "succeeded" as const,
      result: {
        id: `youcam-${externalTaskId}`,
        status: "normalized" as const,
        capturedAt: new Date().toISOString(),
        provider: "youcam" as const,
        providerVersion: this.apiVersion,
        analysisProfileVersion: ROUTINE_SD_PROFILE_VERSION,
        concerns,
        captureWarnings: []
      },
      activity
    };
  }
}

type UploadSession = {
  scanId: string;
  clientRequestId: string;
  status: Scan["status"];
  mimeType: "image/jpeg" | "image/png";
  byteSize: number;
  image?: Uint8Array;
  externalTaskId?: string;
  result?: Scan;
  activity: ScanActivityEvent[];
  error?: { code: string; message: string; retryable: boolean };
  submission?: Promise<void>;
};

type ServerState = {
  createdProducts: Product[];
  uploadSessions: Map<string, UploadSession>;
  scansById: Map<string, UploadSession>;
};

const serverStateKey = Symbol.for("skincause.server-state");
const sharedGlobal = globalThis as typeof globalThis & { [key: symbol]: unknown };
const state = (sharedGlobal[serverStateKey] as ServerState | undefined) ?? {
  createdProducts: [],
  uploadSessions: new Map<string, UploadSession>(),
  scansById: new Map<string, UploadSession>()
};
sharedGlobal[serverStateKey] = state;

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
    return [...products, ...state.createdProducts];
  },
  createProduct(product: Product) {
    state.createdProducts.push(product);
    return product;
  },
  listExperiments() {
    return [seededExperiment];
  },
  getExperiment(id: string) {
    return id === seededExperiment.id ? seededExperiment : null;
  },
  createUploadSession(
    clientRequestId: string,
    input: { mimeType?: "image/jpeg" | "image/png"; byteSize?: number } = {}
  ) {
    const existing = state.uploadSessions.get(clientRequestId);
    if (existing) return existing;
    const scanId = `scan-${clientRequestId}`;
    const session: UploadSession = {
      scanId,
      clientRequestId,
      status: "pending_upload",
      mimeType: input.mimeType ?? "image/jpeg",
      byteSize: input.byteSize ?? 0,
      activity: []
    };
    state.uploadSessions.set(clientRequestId, session);
    state.scansById.set(scanId, session);
    return session;
  },
  storeScanImage(scanId: string, image: Uint8Array, mimeType: string) {
    const session = state.scansById.get(scanId);
    if (!session) return null;
    session.activity ??= [];
    if (mimeType !== session.mimeType || image.byteLength !== session.byteSize) return false;
    session.image = image;
    session.status = "uploaded";
    return true;
  },
  async submitScan(
    scanId: string,
    provider: SkinAnalysisProvider,
    requestedConcerns?: string[],
    captureSource: "upload" | "camera-kit" = "upload"
  ) {
    const session = state.scansById.get(scanId);
    if (!session) return null;
    session.activity ??= [];
    if (!session.image && !session.externalTaskId) {
      return {
        scanId,
        status: session.status,
        error: { code: "UPLOAD_REQUIRED", message: "Upload the image before submitting the scan.", retryable: true }
      };
    }
    if (!session.submission && !session.externalTaskId) {
      session.status = "task_created";
      session.submission = provider
        .createAnalysis({
          image: session.image!,
          mimeType: session.mimeType,
          requestedConcerns: resolveRoutineSdActions(requestedConcerns),
          idempotencyKey: session.clientRequestId,
          captureSource
        })
        .then(({ externalTaskId, activity }) => {
          session.externalTaskId = externalTaskId;
          session.activity.push(...activity);
          session.status = "processing";
          session.image = undefined;
        })
        .catch((error: unknown) => {
          session.status = "provider_failed";
          const providerMessage = error instanceof Error ? error.message : "";
          const providerCode = providerMessage.includes("YOUCAM_API_KEY")
            ? "PROVIDER_CONFIG_MISSING"
            : providerMessage.startsWith("PROVIDER_") || providerMessage.startsWith("IMAGE_")
              ? providerMessage
              : "PROVIDER_NETWORK_ERROR";
          session.error = safeProviderFailure(providerCode);
          session.submission = undefined;
        });
    }
    await session.submission;
    return {
      scanId,
      status: session.status,
      pollAfterMs: session.status === "processing" ? 1500 : undefined,
      activity: session.activity,
      error: session.error
    };
  },
  async getScan(scanId: string, provider?: SkinAnalysisProvider) {
    const session = state.scansById.get(scanId);
    if (!session) return null;
    session.activity ??= [];
    if (session.externalTaskId && provider && session.status === "processing") {
      try {
        const analysis = await provider.getAnalysis(session.externalTaskId);
        session.activity.push(...analysis.activity);
        if (analysis.status === "succeeded") {
          session.status = "normalized";
          session.result = { ...analysis.result, id: scanId };
        } else if (analysis.status === "failed") {
          session.status = "provider_failed";
          session.error = analysis;
        }
      } catch {
        session.status = "provider_failed";
        session.error = {
          code: "PROVIDER_ERROR",
          message: "Analysis is temporarily unavailable.",
          retryable: true
        };
      }
    }
    return {
      scanId,
      status: session.status,
      pollAfterMs: session.status === "processing" ? 1500 : undefined,
      result: session.result,
      activity: session.activity,
      error: session.error
    };
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

export * from "./persistent-scans";
export * from "./persistent-workspace";
export * from "./routine-recommendation";
export * from "./scan-activity";
export * from "./skin-simulation";
