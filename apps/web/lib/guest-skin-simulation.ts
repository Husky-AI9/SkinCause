import type { SkinSimulation } from "@skincause/contracts";
import {
  calculateSkinSimulationParameters,
  scans,
  skinSimulationDisclaimer
} from "@skincause/domain";
import { YouCamSkinSimulationProvider } from "@skincause/server-core";

const parameters = calculateSkinSimulationParameters(scans[0], scans.at(-1)!);
const cacheDurationMs = 90 * 60 * 1000;

type GuestSimulationRecord = {
  status: "queued" | "processing" | "succeeded" | "failed";
  externalTaskId: string | null;
  image: Uint8Array | null;
  mimeType: "image/jpeg" | "image/png" | null;
  generatedAt: string | null;
  expiresAt: string | null;
  errorCode: string | null;
};

const simulationGlobal = globalThis as typeof globalThis & {
  __skincauseGuestSimulationV2?: GuestSimulationRecord;
};

function provider() {
  return new YouCamSkinSimulationProvider(
    process.env.YOUCAM_API_KEY ?? "",
    process.env.YOUCAM_SIMULATION_API_URL
  );
}

function imageMimeType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
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

function isExpired(record: GuestSimulationRecord) {
  return record.expiresAt !== null && new Date(record.expiresAt).getTime() <= Date.now();
}

async function readDemoSourceImage(sourceImageUrl: string) {
  const response = await fetch(sourceImageUrl, { redirect: "error" });
  if (!response.ok) throw new Error("DEMO_SIMULATION_SOURCE_NOT_FOUND");
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > 10_000_000) throw new Error("DEMO_SIMULATION_SOURCE_SIZE_INVALID");
  const image = new Uint8Array(await response.arrayBuffer());
  if (image.byteLength === 0 || image.byteLength > 10_000_000) {
    throw new Error("DEMO_SIMULATION_SOURCE_SIZE_INVALID");
  }
  return image;
}

function publicStatus(experimentId: string, record: GuestSimulationRecord): SkinSimulation {
  return {
    experimentId,
    status: record.status,
    provider: "youcam",
    sourceScanId: scans[0].id,
    targetScanId: scans.at(-1)!.id,
    parameters,
    imageUrl: record.status === "succeeded"
      ? `/api/v1/experiments/${encodeURIComponent(experimentId)}/simulation/image`
      : undefined,
    expiresAt: record.expiresAt,
    generatedAt: record.generatedAt,
    ...(record.status === "queued" || record.status === "processing"
      ? { pollAfterMs: 2000 }
      : {}),
    ...(record.status === "failed"
      ? {
          error: {
            code: record.errorCode ?? "SIMULATION_FAILED",
            message: "The demo illustration could not be generated.",
            retryable: true
          }
        }
      : {}),
    disclaimer: skinSimulationDisclaimer
  };
}

export async function startGuestSkinSimulation(experimentId: string, sourceImageUrl: string) {
  const existing = simulationGlobal.__skincauseGuestSimulationV2;
  if (
    existing &&
    !isExpired(existing) &&
    (existing.status === "queued" || existing.status === "processing")
  ) {
    return publicStatus(experimentId, existing);
  }

  const generationId = crypto.randomUUID();
  const queued: GuestSimulationRecord = {
    status: "queued",
    externalTaskId: null,
    image: null,
    mimeType: null,
    generatedAt: null,
    expiresAt: null,
    errorCode: null
  };
  simulationGlobal.__skincauseGuestSimulationV2 = queued;
  try {
    const simulationProvider = provider();
    const image = await readDemoSourceImage(sourceImageUrl);
    const uploaded = await simulationProvider.uploadSourceImage({
      image,
      mimeType: "image/png",
      fileName: "skincause-demo-face.png",
      idempotencyKey: `skincause-guest-demo-source-v3-${generationId}`
    });
    const started = await simulationProvider.start({
      sourceFileId: uploaded.sourceFileId,
      parameters,
      idempotencyKey: `skincause-guest-demo-improvement-v3-${generationId}`
    });
    const processing: GuestSimulationRecord = {
      ...queued,
      status: "processing",
      externalTaskId: started.externalTaskId
    };
    simulationGlobal.__skincauseGuestSimulationV2 = processing;
    return publicStatus(experimentId, processing);
  } catch {
    const failed: GuestSimulationRecord = {
      ...queued,
      status: "failed",
      errorCode: "SIMULATION_START_FAILED"
    };
    simulationGlobal.__skincauseGuestSimulationV2 = failed;
    return publicStatus(experimentId, failed);
  }
}

export async function getGuestSkinSimulation(experimentId: string) {
  let record = simulationGlobal.__skincauseGuestSimulationV2;
  if (!record) return null;
  if (isExpired(record)) {
    simulationGlobal.__skincauseGuestSimulationV2 = undefined;
    return {
      ...publicStatus(experimentId, record),
      status: "expired" as const,
      imageUrl: undefined
    };
  }
  if (record.status !== "processing" || !record.externalTaskId) {
    return publicStatus(experimentId, record);
  }

  const providerResult = await provider().get(record.externalTaskId);
  if (providerResult.status === "processing") return publicStatus(experimentId, record);
  if (providerResult.status === "failed") {
    record = {
      ...record,
      status: "failed",
      errorCode: providerResult.code
    };
    simulationGlobal.__skincauseGuestSimulationV2 = record;
    return publicStatus(experimentId, record);
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
    const mimeType = imageMimeType(image);
    if (!mimeType) throw new Error("SIMULATION_IMAGE_FORMAT_INVALID");
    const generatedAt = new Date();
    record = {
      ...record,
      status: "succeeded",
      image,
      mimeType,
      generatedAt: generatedAt.toISOString(),
      expiresAt: new Date(generatedAt.getTime() + cacheDurationMs).toISOString(),
      errorCode: null
    };
  } catch {
    record = {
      ...record,
      status: "failed",
      errorCode: "SIMULATION_IMAGE_PROCESSING_FAILED"
    };
  }
  simulationGlobal.__skincauseGuestSimulationV2 = record;
  return publicStatus(experimentId, record);
}

export function readGuestSkinSimulationImage() {
  const record = simulationGlobal.__skincauseGuestSimulationV2;
  if (
    !record ||
    record.status !== "succeeded" ||
    isExpired(record) ||
    !record.image ||
    !record.mimeType
  ) {
    return null;
  }
  return { image: record.image, mimeType: record.mimeType };
}

export function deleteGuestSkinSimulation() {
  simulationGlobal.__skincauseGuestSimulationV2 = undefined;
}

export async function generateGuestSkinSimulationImage(
  image: Uint8Array,
  mimeType: "image/jpeg" | "image/png"
) {
  const simulationProvider = provider();
  const generationId = crypto.randomUUID();
  const uploaded = await simulationProvider.uploadSourceImage({
    image,
    mimeType,
    fileName: mimeType === "image/png" ? "skincause-demo-face.png" : "skincause-demo-face.jpg",
    idempotencyKey: `skincause-demo-source-v4-${generationId}`
  });
  const started = await simulationProvider.start({
    sourceFileId: uploaded.sourceFileId,
    parameters,
    idempotencyKey: `skincause-demo-improvement-v4-${generationId}`
  });
  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    const result = await simulationProvider.get(started.externalTaskId);
    if (result.status === "failed") throw new Error(result.code);
    if (result.status === "succeeded") {
      const response = await fetch(result.resultUrl, { redirect: "error" });
      if (!response.ok) throw new Error("SIMULATION_IMAGE_DOWNLOAD_FAILED");
      const generatedImage = new Uint8Array(await response.arrayBuffer());
      if (generatedImage.byteLength === 0 || generatedImage.byteLength > 10_000_000) {
        throw new Error("SIMULATION_IMAGE_SIZE_INVALID");
      }
      const generatedMimeType = imageMimeType(generatedImage);
      if (!generatedMimeType) throw new Error("SIMULATION_IMAGE_FORMAT_INVALID");
      return { image: generatedImage, mimeType: generatedMimeType };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error("SIMULATION_TIMED_OUT");
}
