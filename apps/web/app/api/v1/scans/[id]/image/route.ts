import { failure, success } from "@skincause/server-core";
import {
  AuthenticationError,
  createPersistentScanService,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      return Response.json(success({ scanId: id, imageDeleted: true, derivedScoresRetained: true }));
    }
    const result = await createPersistentScanService(actor).deleteImage(actor.userId, id);
    if (!result) {
      return Response.json(failure("SCAN_NOT_FOUND", "The scan was not found.", false), { status: 404 });
    }
    return Response.json(success(result));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(failure("PERSISTENCE_UNAVAILABLE", "The image could not be deleted. Try again.", true), {
      status: 503
    });
  }
}
