import {
  PersistentScanService,
  failure,
  success,
  type ScanImageStore
} from "@skincause/server-core";
import { createSkinAnalysisProvider } from "../../../../../lib/skin-analysis";
import {
  AuthenticationError,
  SupabaseScanRepository,
  resolveRequestActor
} from "../../../../../lib/supabase-server";

export const maxDuration = 60;

class RequestImageStore implements ScanImageStore {
  private readonly images = new Map<string, Uint8Array>();

  async put(path: string, image: Uint8Array) {
    this.images.set(path, image);
  }

  async get(path: string) {
    return this.images.get(path) ?? null;
  }

  async remove(path: string) {
    this.images.delete(path);
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    if (actor.kind !== "authenticated") {
      return Response.json(
        failure("AUTH_REQUIRED", "Start the demo before analyzing its sample image.", false),
        { status: 401 }
      );
    }

    const body = (await request.json()) as { clientRequestId?: string };
    if (!body.clientRequestId) {
      return Response.json(
        failure("REQUEST_ID_REQUIRED", "Start the demo analysis again.", true),
        { status: 400 }
      );
    }

    const imageResponse = await fetch(new URL("/images/demo-face-acne.png", request.url), {
      cache: "force-cache"
    });
    if (!imageResponse.ok) {
      return Response.json(
        failure("DEMO_IMAGE_UNAVAILABLE", "The sample image could not be prepared.", true),
        { status: 503 }
      );
    }

    const image = new Uint8Array(await imageResponse.arrayBuffer());
    const provider = createSkinAnalysisProvider();
    const service = new PersistentScanService(
      new SupabaseScanRepository(actor.client),
      new RequestImageStore()
    );
    const scan = await service.createUploadSession(actor.userId, body.clientRequestId, {
      mimeType: "image/png",
      byteSize: image.byteLength,
      provider: provider.providerName,
      retainImage: false
    });
    const stored = await service.storeScanImage(
      actor.userId,
      scan.id,
      image,
      "image/png"
    );
    if (stored !== "stored") {
      throw new Error("DEMO_IMAGE_STORE_FAILED");
    }

    let status = await service.submitScan(actor.userId, scan.id, provider, undefined, "upload");
    const deadline = Date.now() + 50_000;
    while (status?.status === "processing" && Date.now() < deadline) {
      await wait(status.pollAfterMs ?? 1_500);
      status = await service.getScan(actor.userId, scan.id, provider);
    }

    if (!status) {
      return Response.json(failure("SCAN_NOT_FOUND", "The demo scan was not found.", true), {
        status: 404
      });
    }
    if (status.status === "processing") {
      return Response.json(
        failure("SCAN_TIMED_OUT", "The analysis is taking longer than expected. Try again.", true),
        { status: 504 }
      );
    }
    if (!status.result) {
      return Response.json(
        failure(
          status.error?.code ?? "ANALYSIS_FAILED",
          status.error?.message ?? "The demo image could not be analyzed.",
          status.error?.retryable ?? true
        ),
        { status: 502 }
      );
    }

    return Response.json(success(status));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(
      failure("DEMO_ANALYSIS_UNAVAILABLE", "The demo analysis is temporarily unavailable.", true),
      { status: 503 }
    );
  }
}
