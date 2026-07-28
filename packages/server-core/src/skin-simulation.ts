import type {
  SkinSimulation,
  SkinSimulationParameters
} from "@skincause/contracts";
import { skinSimulationDisclaimer } from "@skincause/domain";
import { z } from "zod";
import { youCamFileResponseSchema } from "./youcam-schemas";

const youCamSimulationStartSchema = z.object({
  data: z.object({
    task_id: z.string().min(1)
  }).passthrough()
}).passthrough();

const youCamSimulationStatusSchema = z.object({
  data: z.object({
    task_status: z.string(),
    error: z.unknown().nullish(),
    error_code: z.string().nullish(),
    results: z.object({
      url: z.string().url().refine((value) => new URL(value).protocol === "https:")
    }).nullish()
  }).passthrough()
}).passthrough();

export interface SkinSimulationProvider {
  readonly providerName: "youcam" | "mock";
  readonly providerVersion: string;
  start(input: ({
    sourceImageUrl: string;
    sourceFileId?: never;
  } | {
    sourceImageUrl?: never;
    sourceFileId: string;
  }) & {
    parameters: SkinSimulationParameters;
    idempotencyKey: string;
  }): Promise<{ externalTaskId: string }>;
  get(externalTaskId: string): Promise<
    | { status: "processing" }
    | { status: "failed"; code: string; message: string; retryable: boolean }
    | { status: "succeeded"; resultUrl: string }
  >;
}

export class YouCamSkinSimulationProvider implements SkinSimulationProvider {
  readonly providerName = "youcam" as const;
  readonly providerVersion = "v2.0";

  constructor(
    private readonly apiKey: string,
    private readonly endpoint =
      "https://yce-api-01.makeupar.com/s2s/v2.0/task/skin-simulation"
  ) {}

  async uploadSourceImage(input: {
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    fileName: string;
    idempotencyKey: string;
  }) {
    if (!this.apiKey) throw new Error("YOUCAM_API_KEY is required when mock mode is disabled.");
    if (input.image.byteLength === 0 || input.image.byteLength > 10_000_000) {
      throw new Error("SIMULATION_SOURCE_IMAGE_SIZE_INVALID");
    }
    const fileEndpoint = this.endpoint.replace(
      /\/task\/skin-simulation$/,
      "/file/skin-simulation"
    );
    if (fileEndpoint === this.endpoint) throw new Error("SIMULATION_FILE_ENDPOINT_INVALID");

    const fileResponse = await fetch(fileEndpoint, {
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
            file_name: input.fileName,
            file_size: input.image.byteLength
          }
        ]
      })
    });
    if (!fileResponse.ok) throw new Error("SIMULATION_FILE_REQUEST_FAILED");
    const filePayload = youCamFileResponseSchema.safeParse(await fileResponse.json());
    if (!filePayload.success) throw new Error("SIMULATION_FILE_SCHEMA_CHANGED");
    const file = filePayload.data.data.files[0];
    const upload = file.requests[0];
    const uploadResponse = await fetch(upload.url, {
      method: upload.method ?? "PUT",
      headers: upload.headers,
      body: input.image.slice().buffer as ArrayBuffer
    });
    if (!uploadResponse.ok) throw new Error("SIMULATION_SOURCE_UPLOAD_FAILED");
    return { sourceFileId: file.file_id };
  }

  async start(input: ({
    sourceImageUrl: string;
    sourceFileId?: never;
  } | {
    sourceImageUrl?: never;
    sourceFileId: string;
  }) & {
    parameters: SkinSimulationParameters;
    idempotencyKey: string;
  }) {
    if (!this.apiKey) throw new Error("YOUCAM_API_KEY is required when mock mode is disabled.");
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify({
        ...("sourceFileId" in input
          ? { src_file_id: input.sourceFileId }
          : { src_file_url: input.sourceImageUrl }),
        acne: input.parameters.acne,
        dark_circle: input.parameters.darkCircle,
        eye_bags: input.parameters.eyeBags,
        oiliness: input.parameters.oiliness,
        pores: input.parameters.pores,
        radiance: input.parameters.radiance,
        redness: input.parameters.redness,
        spots: input.parameters.spots,
        texture: input.parameters.texture,
        wrinkle: input.parameters.wrinkle
      })
    });
    if (!response.ok) throw new Error("SIMULATION_START_FAILED");
    const payload = youCamSimulationStartSchema.safeParse(await response.json());
    if (!payload.success) throw new Error("SIMULATION_PROVIDER_SCHEMA_CHANGED");
    return { externalTaskId: payload.data.data.task_id };
  }

  async get(externalTaskId: string) {
    const response = await fetch(`${this.endpoint}/${encodeURIComponent(externalTaskId)}`, {
      headers: { authorization: `Bearer ${this.apiKey}` }
    });
    if (!response.ok) {
      return {
        status: "failed" as const,
        code: "SIMULATION_PROVIDER_ERROR",
        message: "The illustrative simulation is temporarily unavailable.",
        retryable: response.status >= 500
      };
    }
    const payload = youCamSimulationStatusSchema.safeParse(await response.json());
    if (!payload.success) {
      return {
        status: "failed" as const,
        code: "SIMULATION_PROVIDER_SCHEMA_CHANGED",
        message: "The simulation response could not be normalized.",
        retryable: false
      };
    }
    if (payload.data.data.task_status === "error") {
      return {
        status: "failed" as const,
        code: "SIMULATION_PROVIDER_ERROR",
        message: "YouCam could not generate this illustrative simulation.",
        retryable: false
      };
    }
    if (payload.data.data.task_status !== "success") {
      return { status: "processing" as const };
    }
    const resultUrl = payload.data.data.results?.url;
    if (!resultUrl) {
      return {
        status: "failed" as const,
        code: "SIMULATION_PROVIDER_SCHEMA_CHANGED",
        message: "The simulation image was missing from the provider response.",
        retryable: false
      };
    }
    return { status: "succeeded" as const, resultUrl };
  }
}

export class MockSkinSimulationProvider implements SkinSimulationProvider {
  readonly providerName = "mock" as const;
  readonly providerVersion = "deterministic-simulation-v1";

  constructor(private readonly resultUrl: string) {}

  async start(input: { idempotencyKey: string }) {
    return { externalTaskId: `mock_${input.idempotencyKey}` };
  }

  async get() {
    return { status: "succeeded" as const, resultUrl: this.resultUrl };
  }
}

export type StoredSkinSimulation = {
  ownerId: string;
  experimentId: string;
  sourceScanId: string;
  targetScanId: string;
  status: Exclude<SkinSimulation["status"], "not_started">;
  provider: "youcam" | "mock";
  providerVersion: string;
  externalTaskId: string | null;
  inputHash: string;
  parameters: SkinSimulationParameters;
  resultPath: string | null;
  resultMimeType: "image/jpeg" | "image/png" | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type StoredSkinSimulationPatch = Partial<
  Pick<
    StoredSkinSimulation,
    | "status"
    | "externalTaskId"
    | "resultPath"
    | "resultMimeType"
    | "errorCode"
    | "updatedAt"
    | "expiresAt"
  >
>;

export interface SkinSimulationRepository {
  find(ownerId: string, experimentId: string): Promise<StoredSkinSimulation | null>;
  upsert(record: StoredSkinSimulation): Promise<StoredSkinSimulation>;
  update(
    ownerId: string,
    experimentId: string,
    patch: StoredSkinSimulationPatch
  ): Promise<StoredSkinSimulation>;
}

export interface SkinSimulationImageStore {
  put(
    path: string,
    image: Uint8Array,
    mimeType: "image/jpeg" | "image/png"
  ): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  remove(path: string): Promise<void>;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function publicSimulation(record: StoredSkinSimulation): SkinSimulation {
  return {
    experimentId: record.experimentId,
    status: record.status,
    provider: record.provider,
    sourceScanId: record.sourceScanId,
    targetScanId: record.targetScanId,
    parameters: record.parameters,
    expiresAt: record.expiresAt,
    generatedAt: record.status === "succeeded" ? record.updatedAt : null,
    ...(record.status === "queued" || record.status === "processing"
      ? { pollAfterMs: 2000 }
      : {}),
    ...(record.status === "failed"
      ? {
          error: {
            code: record.errorCode ?? "SIMULATION_FAILED",
            message: "The illustrative simulation could not be generated.",
            retryable: true
          }
        }
      : {}),
    disclaimer: skinSimulationDisclaimer
  };
}

function detectedMimeType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export class PersistentSkinSimulationService {
  constructor(
    private readonly repository: SkinSimulationRepository,
    private readonly images: SkinSimulationImageStore,
    private readonly provider: SkinSimulationProvider
  ) {}

  async start(
    ownerId: string,
    input: {
      experimentId: string;
      sourceScanId: string;
      targetScanId: string;
      sourceImageUrl: string;
      parameters: SkinSimulationParameters;
    }
  ) {
    const inputHash = await sha256(JSON.stringify({
      version: "skin-simulation-v1",
      provider: this.provider.providerVersion,
      sourceScanId: input.sourceScanId,
      targetScanId: input.targetScanId,
      parameters: input.parameters
    }));
    const existing = await this.repository.find(ownerId, input.experimentId);
    const stillAvailable =
      existing?.status === "succeeded" &&
      existing.expiresAt !== null &&
      new Date(existing.expiresAt).getTime() > Date.now();
    if (
      existing?.inputHash === inputHash &&
      (existing.status === "queued" || existing.status === "processing" || stillAvailable)
    ) {
      return publicSimulation(existing);
    }
    const providerIdempotencyKey = existing
      ? await sha256(`${inputHash}:${existing.status}:${existing.updatedAt}`)
      : inputHash;
    if (existing?.resultPath) await this.images.remove(existing.resultPath);

    const now = new Date().toISOString();
    let record = await this.repository.upsert({
      ownerId,
      experimentId: input.experimentId,
      sourceScanId: input.sourceScanId,
      targetScanId: input.targetScanId,
      status: "queued",
      provider: this.provider.providerName,
      providerVersion: this.provider.providerVersion,
      externalTaskId: null,
      inputHash,
      parameters: input.parameters,
      resultPath: null,
      resultMimeType: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: null
    });
    try {
      const started = await this.provider.start({
        sourceImageUrl: input.sourceImageUrl,
        parameters: input.parameters,
        idempotencyKey: providerIdempotencyKey
      });
      record = await this.repository.update(ownerId, input.experimentId, {
        status: "processing",
        externalTaskId: started.externalTaskId,
        updatedAt: new Date().toISOString()
      });
    } catch {
      record = await this.repository.update(ownerId, input.experimentId, {
        status: "failed",
        errorCode: "SIMULATION_START_FAILED",
        updatedAt: new Date().toISOString()
      });
    }
    return publicSimulation(record);
  }

  async get(ownerId: string, experimentId: string) {
    let record = await this.repository.find(ownerId, experimentId);
    if (!record) return null;
    if (
      record.status === "succeeded" &&
      record.expiresAt &&
      new Date(record.expiresAt).getTime() <= Date.now()
    ) {
      if (record.resultPath) await this.images.remove(record.resultPath);
      record = await this.repository.update(ownerId, experimentId, {
        status: "expired",
        resultPath: null,
        resultMimeType: null,
        updatedAt: new Date().toISOString()
      });
      return publicSimulation(record);
    }
    if (record.status !== "processing" || !record.externalTaskId) {
      return publicSimulation(record);
    }

    const providerResult = await this.provider.get(record.externalTaskId);
    if (providerResult.status === "processing") return publicSimulation(record);
    if (providerResult.status === "failed") {
      record = await this.repository.update(ownerId, experimentId, {
        status: "failed",
        errorCode: providerResult.code,
        updatedAt: new Date().toISOString()
      });
      return publicSimulation(record);
    }

    try {
      const response = await fetch(providerResult.resultUrl, { redirect: "error" });
      if (!response.ok) throw new Error("SIMULATION_IMAGE_DOWNLOAD_FAILED");
      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > 10_000_000) throw new Error("SIMULATION_IMAGE_TOO_LARGE");
      const image = new Uint8Array(await response.arrayBuffer());
      if (image.byteLength === 0 || image.byteLength > 10_000_000) {
        throw new Error("SIMULATION_IMAGE_TOO_LARGE");
      }
      const mimeType = detectedMimeType(image);
      if (!mimeType) throw new Error("SIMULATION_IMAGE_FORMAT_INVALID");
      const extension = mimeType === "image/png" ? "png" : "jpg";
      const resultPath = `${ownerId}/${experimentId}/illustration.${extension}`;
      await this.images.put(resultPath, image, mimeType);
      const updatedAt = new Date();
      record = await this.repository.update(ownerId, experimentId, {
        status: "succeeded",
        resultPath,
        resultMimeType: mimeType,
        errorCode: null,
        updatedAt: updatedAt.toISOString(),
        expiresAt: new Date(updatedAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
      });
      return publicSimulation(record);
    } catch {
      record = await this.repository.update(ownerId, experimentId, {
        status: "failed",
        errorCode: "SIMULATION_IMAGE_PROCESSING_FAILED",
        updatedAt: new Date().toISOString()
      });
      return publicSimulation(record);
    }
  }

  async readImage(ownerId: string, experimentId: string) {
    const status = await this.get(ownerId, experimentId);
    if (!status || status.status !== "succeeded") return null;
    const record = await this.repository.find(ownerId, experimentId);
    if (!record?.resultPath || !record.resultMimeType) return null;
    const image = await this.images.get(record.resultPath);
    return image ? { image, mimeType: record.resultMimeType } : null;
  }

  async delete(ownerId: string, experimentId: string) {
    let record = await this.repository.find(ownerId, experimentId);
    if (!record) return null;
    if (record.resultPath) await this.images.remove(record.resultPath);
    record = await this.repository.update(ownerId, experimentId, {
      status: "expired",
      resultPath: null,
      resultMimeType: null,
      expiresAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return publicSimulation(record);
  }
}
