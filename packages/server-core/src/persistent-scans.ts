import {
  AI_ACNE_SEVERITY_CONCERN_KEY,
  type Concern,
  type Scan,
  type ScanActivityEvent
} from "@skincause/contracts";
import type { SkinAnalysisProvider } from "./index";
import { scanActivity } from "./scan-activity";
import {
  ROUTINE_SD_PROFILE_VERSION,
  resolveRoutineSdActions
} from "./skin-analysis-profile";
import { safeProviderFailure } from "./provider-errors";

export type StoredScan = {
  id: string;
  ownerId: string;
  status: Scan["status"];
  provider: "mock" | "youcam";
  providerVersion: string | null;
  analysisProfileVersion: string;
  externalTaskId: string | null;
  capturedAt: string;
  imagePath: string | null;
  retainImage: boolean;
  clientRequestId: string;
};

export type StoredScanPatch = Partial<
  Pick<
    StoredScan,
    "status" | "providerVersion" | "analysisProfileVersion" | "externalTaskId" | "capturedAt" | "imagePath" | "retainImage"
  >
>;

export interface ScanRepository {
  findByClientRequestId(ownerId: string, clientRequestId: string): Promise<StoredScan | null>;
  findById(ownerId: string, scanId: string): Promise<StoredScan | null>;
  create(scan: StoredScan): Promise<StoredScan>;
  update(ownerId: string, scanId: string, patch: StoredScanPatch): Promise<StoredScan>;
  listConcerns(ownerId: string, scanId: string): Promise<Concern[]>;
  replaceConcerns(ownerId: string, scanId: string, concerns: Concern[]): Promise<void>;
}

export interface ScanImageStore {
  put(path: string, image: Uint8Array, mimeType: "image/jpeg" | "image/png"): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  remove(path: string): Promise<void>;
}

export type PersistentScanStatus = {
  scanId: string;
  status: Scan["status"];
  pollAfterMs?: number;
  result?: Scan;
  activity?: ScanActivityEvent[];
  error?: { code: string; message: string; retryable: boolean };
};

function uploadMetadata(path: string) {
  const fileName = path.split("/").at(-1) ?? "";
  const match = /^(\d+)\.(jpg|png)$/.exec(fileName);
  if (!match) return null;
  return {
    byteSize: Number(match[1]),
    mimeType: match[2] === "png" ? "image/png" as const : "image/jpeg" as const
  };
}

export class PersistentScanService {
  constructor(
    private readonly repository: ScanRepository,
    private readonly images: ScanImageStore
  ) {}

  async createUploadSession(
    ownerId: string,
    clientRequestId: string,
    input: {
      mimeType: "image/jpeg" | "image/png";
      byteSize: number;
      provider: "mock" | "youcam";
      retainImage?: boolean;
    }
  ) {
    const existing = await this.repository.findByClientRequestId(ownerId, clientRequestId);
    if (existing) return existing;

    const scanId = crypto.randomUUID();
    const extension = input.mimeType === "image/png" ? "png" : "jpg";
    return this.repository.create({
      id: scanId,
      ownerId,
      status: "pending_upload",
      provider: input.provider,
      providerVersion: null,
      analysisProfileVersion: ROUTINE_SD_PROFILE_VERSION,
      externalTaskId: null,
      capturedAt: new Date().toISOString(),
      imagePath: `${ownerId}/${scanId}/${input.byteSize}.${extension}`,
      retainImage: input.retainImage ?? false,
      clientRequestId
    });
  }

  async storeScanImage(
    ownerId: string,
    scanId: string,
    image: Uint8Array,
    mimeType: string
  ): Promise<"stored" | "not-found" | "mismatch"> {
    const scan = await this.repository.findById(ownerId, scanId);
    if (!scan?.imagePath) return "not-found";
    const expected = uploadMetadata(scan.imagePath);
    if (!expected || expected.mimeType !== mimeType || expected.byteSize !== image.byteLength) {
      return "mismatch";
    }

    await this.images.put(scan.imagePath, image, expected.mimeType);
    await this.repository.update(ownerId, scanId, { status: "uploaded" });
    return "stored";
  }

  async submitScan(
    ownerId: string,
    scanId: string,
    provider: SkinAnalysisProvider,
    requestedConcerns?: string[],
    captureSource: "upload" | "camera-kit" = "upload"
  ): Promise<PersistentScanStatus | null> {
    let scan = await this.repository.findById(ownerId, scanId);
    if (!scan) return null;
    if (scan.externalTaskId) {
      return {
        scanId,
        status: scan.status,
        pollAfterMs: scan.status === "processing" ? 1500 : undefined
      };
    }
    if (!scan.imagePath || !["pending_upload", "uploaded", "task_created", "provider_failed"].includes(scan.status)) {
      return {
        scanId,
        status: scan.status,
        error: {
          code: "UPLOAD_REQUIRED",
          message: "Upload the image before submitting the scan.",
          retryable: true
        }
      };
    }

    const image = await this.images.get(scan.imagePath);
    if (!image) {
      return {
        scanId,
        status: scan.status,
        error: {
          code: "UPLOAD_REQUIRED",
          message: "Upload the image before submitting the scan.",
          retryable: true
        }
      };
    }
    const metadata = uploadMetadata(scan.imagePath);
    if (!metadata) {
      return {
        scanId,
        status: "upload_failed",
        error: {
          code: "UPLOAD_INVALID",
          message: "The uploaded image metadata could not be verified.",
          retryable: true
        }
      };
    }
    if (image.byteLength !== metadata.byteSize) {
      await this.images.remove(scan.imagePath);
      await this.repository.update(ownerId, scanId, { status: "upload_failed" });
      return {
        scanId,
        status: "upload_failed",
        error: {
          code: "UPLOAD_MISMATCH",
          message: "The uploaded image does not match the reserved size.",
          retryable: true
        }
      };
    }

    await this.repository.update(ownerId, scanId, { status: "task_created" });
    try {
      const created = await provider.createAnalysis({
        image,
        mimeType: metadata.mimeType,
        requestedConcerns: resolveRoutineSdActions(requestedConcerns),
        idempotencyKey: scan.clientRequestId,
        captureSource
      });
      scan = await this.repository.update(ownerId, scanId, {
        status: "processing",
        externalTaskId: created.externalTaskId
      });
      return {
        scanId,
        status: scan.status,
        pollAfterMs: 1500,
        activity: created.activity
      };
    } catch (error) {
      await this.repository.update(ownerId, scanId, { status: "provider_failed" });
      const providerMessage = error instanceof Error ? error.message : "";
      const providerCode =
        providerMessage.startsWith("PROVIDER_") || providerMessage.startsWith("IMAGE_")
          ? providerMessage
          : "PROVIDER_NETWORK_ERROR";
      const failure = safeProviderFailure(providerCode);
      return {
        scanId,
        status: "provider_failed",
        error: failure
      };
    }
  }

  async getScan(
    ownerId: string,
    scanId: string,
    provider?: SkinAnalysisProvider
  ): Promise<PersistentScanStatus | null> {
    let scan = await this.repository.findById(ownerId, scanId);
    if (!scan) return null;

    if (scan.externalTaskId && provider && scan.status === "processing") {
      try {
        const analysis = await provider.getAnalysis(scan.externalTaskId);
        if (analysis.status === "succeeded") {
          await this.repository.replaceConcerns(ownerId, scanId, analysis.result.concerns);
          scan = await this.repository.update(ownerId, scanId, {
            status: "normalized",
            capturedAt: analysis.result.capturedAt,
            providerVersion: analysis.result.providerVersion ?? null,
            analysisProfileVersion:
              analysis.result.analysisProfileVersion ?? ROUTINE_SD_PROFILE_VERSION
          });
          const completionActivity = [...analysis.activity];
          if (!scan.retainImage && scan.imagePath) {
            await this.images.remove(scan.imagePath);
            scan = await this.repository.update(ownerId, scanId, { imagePath: null });
            completionActivity.push(
              scanActivity("storage", "original image deleted after normalized results were stored", "success")
            );
          }
          return {
            scanId,
            status: scan.status,
            activity: [
              ...completionActivity,
              scanActivity(
                "skincause",
                `${analysis.result.concerns.filter((concern) => concern.normalizedSeverity !== null).length} scores and ${analysis.result.concerns.filter((concern) => concern.maskUrl).length} masks persisted`,
                "success"
              )
            ],
            result: {
              ...analysis.result,
              id: scan.id,
              status: scan.status
            }
          };
        } else if (analysis.status === "failed") {
          scan = await this.repository.update(ownerId, scanId, { status: "provider_failed" });
          return {
            scanId,
            status: scan.status,
            error: {
              code: analysis.code,
              message: analysis.message,
              retryable: analysis.retryable
            },
            activity: analysis.activity
          };
        }
        return {
          scanId,
          status: scan.status,
          pollAfterMs: 1500,
          activity: analysis.activity
        };
      } catch {
        return {
          scanId,
          status: scan.status,
          pollAfterMs: 1500,
          error: {
            code: "PROVIDER_ERROR",
            message: "Analysis is temporarily unavailable.",
            retryable: true
          }
        };
      }
    }

    if (scan.status === "normalized" || scan.status === "succeeded") {
      let concerns = await this.repository.listConcerns(ownerId, scanId);
      if (
        provider?.enrichAcnePattern &&
        !concerns.some((concern) => concern.key === AI_ACNE_SEVERITY_CONCERN_KEY)
      ) {
        try {
          const enriched = await provider.enrichAcnePattern({
            id: scan.id,
            status: scan.status,
            capturedAt: scan.capturedAt,
            provider: scan.provider,
            providerVersion: scan.providerVersion ?? undefined,
            analysisProfileVersion: scan.analysisProfileVersion,
            concerns,
            captureWarnings: []
          }, `stored-acne-pattern-${scan.id}`);
          if (enriched.concerns.some((concern) => concern.key === AI_ACNE_SEVERITY_CONCERN_KEY)) {
            await this.repository.replaceConcerns(ownerId, scanId, enriched.concerns);
            concerns = enriched.concerns;
          }
        } catch {
          // The original normalized scan remains usable when the optional AI assessment is unavailable.
        }
      }
      return {
        scanId,
        status: scan.status,
        result: {
          id: scan.id,
          status: scan.status,
          capturedAt: scan.capturedAt,
            provider: scan.provider,
            providerVersion: scan.providerVersion ?? undefined,
            analysisProfileVersion: scan.analysisProfileVersion,
            concerns,
          captureWarnings: []
        }
      };
    }

    return {
      scanId,
      status: scan.status,
      pollAfterMs: scan.status === "processing" ? 1500 : undefined,
      error: scan.status === "provider_failed"
        ? {
            code: "PROVIDER_ERROR",
            message: "Analysis is temporarily unavailable.",
            retryable: true
          }
        : undefined
    };
  }

  async deleteImage(ownerId: string, scanId: string) {
    const scan = await this.repository.findById(ownerId, scanId);
    if (!scan) return null;
    if (scan.imagePath) {
      await this.images.remove(scan.imagePath);
      await this.repository.update(ownerId, scanId, { imagePath: null, retainImage: false });
    }
    return { scanId, imageDeleted: true, derivedScoresRetained: true };
  }
}
