import {
  failure,
  serverServices,
  success
} from "@skincause/server-core";
import { createSkinAnalysisProvider } from "../../../../../lib/skin-analysis";

export const maxDuration = 60;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: Request) {
  try {
    const clientRequestId = request.headers.get("x-client-request-id");
    if (!clientRequestId) {
      return Response.json(
        failure("REQUEST_ID_REQUIRED", "Start the demo analysis again.", true),
        { status: 400 }
      );
    }
    if (request.headers.get("content-type") !== "image/png") {
      return Response.json(
        failure("UNSUPPORTED_FORMAT", "The demo image must be a PNG.", false),
        { status: 400 }
      );
    }

    const image = new Uint8Array(await request.arrayBuffer());
    if (image.byteLength === 0 || image.byteLength >= 4_000_000) {
      return Response.json(
        failure("DEMO_IMAGE_INVALID", "The sample image could not be prepared.", true),
        { status: 400 }
      );
    }
    const provider = createSkinAnalysisProvider();
    const session = serverServices.createUploadSession(`demo-${clientRequestId}`, {
      mimeType: "image/png",
      byteSize: image.byteLength
    });
    const stored = serverServices.storeScanImage(session.scanId, image, "image/png");
    if (stored !== true) {
      throw new Error("DEMO_IMAGE_STORE_FAILED");
    }

    let status = await serverServices.submitScan(session.scanId, provider, undefined, "upload");
    const deadline = Date.now() + 50_000;
    while (status?.status === "processing" && Date.now() < deadline) {
      await wait(status.pollAfterMs ?? 1_500);
      status = await serverServices.getScan(session.scanId, provider);
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
    if (!("result" in status) || !status.result) {
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
  } catch {
    return Response.json(
      failure("DEMO_ANALYSIS_UNAVAILABLE", "The demo analysis is temporarily unavailable.", true),
      { status: 503 }
    );
  }
}
