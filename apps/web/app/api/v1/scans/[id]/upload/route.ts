import { failure, serverServices, success } from "@skincause/server-core";
import {
  AuthenticationError,
  createPersistentScanService,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const mimeType = request.headers.get("content-type")?.split(";")[0] ?? "";
    const image = new Uint8Array(await request.arrayBuffer());
    const actor = await resolveRequestActor(request);
    if (actor.kind === "authenticated") {
      const stored = await createPersistentScanService(actor).storeScanImage(
        actor.userId,
        id,
        image,
        mimeType
      );
      if (stored === "not-found") {
        return Response.json(failure("SCAN_NOT_FOUND", "The scan upload session was not found.", false), {
          status: 404
        });
      }
      if (stored === "mismatch") {
        return Response.json(
          failure("UPLOAD_MISMATCH", "The uploaded image does not match the reserved type and size.", true),
          { status: 400 }
        );
      }
    } else {
      const stored = serverServices.storeScanImage(id, image, mimeType);
      if (stored === null) {
        return Response.json(failure("SCAN_NOT_FOUND", "The scan upload session was not found.", false), {
          status: 404
        });
      }
      if (!stored) {
        return Response.json(
          failure("UPLOAD_MISMATCH", "The uploaded image does not match the reserved type and size.", true),
          { status: 400 }
        );
      }
    }
    return Response.json(success({ scanId: id, status: "uploaded" }));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(failure("PERSISTENCE_UNAVAILABLE", "The image could not be saved. Try again.", true), {
      status: 503
    });
  }
}
