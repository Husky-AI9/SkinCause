import { serverServices, success } from "@skincause/server-core";
import { failure } from "@skincause/server-core";
import { createSkinAnalysisProvider } from "../../../../../../lib/skin-analysis";
import {
  AuthenticationError,
  createPersistentScanService,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      concerns?: string[];
      captureSource?: "upload" | "camera-kit";
    };
    const actor = await resolveRequestActor(request);
    const provider = createSkinAnalysisProvider();
    const result = actor.kind === "authenticated"
      ? await createPersistentScanService(actor).submitScan(
          actor.userId,
          id,
          provider,
          body.concerns,
          body.captureSource
        )
      : await serverServices.submitScan(id, provider, body.concerns, body.captureSource);
    if (!result) {
      return Response.json(failure("SCAN_NOT_FOUND", "The scan was not found.", false), { status: 404 });
    }
    if (result.error?.code === "UPLOAD_REQUIRED") {
      return Response.json(failure(result.error.code, result.error.message, result.error.retryable), { status: 409 });
    }
    return Response.json(success(result), { status: 202 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(failure("PERSISTENCE_UNAVAILABLE", "The scan could not be submitted. Try again.", true), {
      status: 503
    });
  }
}
