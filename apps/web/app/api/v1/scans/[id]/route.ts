import { failure, serverServices, success } from "@skincause/server-core";
import { createSkinAnalysisProvider } from "../../../../../lib/skin-analysis";
import {
  AuthenticationError,
  createPersistentScanService,
  resolveRequestActor
} from "../../../../../lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await resolveRequestActor(request);
    const provider = createSkinAnalysisProvider();
    const scan = actor.kind === "authenticated"
      ? await createPersistentScanService(actor).getScan(actor.userId, id, provider)
      : await serverServices.getScan(id, provider);
    if (!scan) {
      return Response.json(failure("SCAN_NOT_FOUND", "The scan was not found.", false), { status: 404 });
    }
    return Response.json(success(scan));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(failure("PERSISTENCE_UNAVAILABLE", "The scan status is temporarily unavailable.", true), {
      status: 503
    });
  }
}
