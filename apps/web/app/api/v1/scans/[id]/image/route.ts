import { failure, success } from "@skincause/server-core";
import {
  AuthenticationError,
  createPersistentScanService,
  resolveRequestActor,
  SupabaseScanImageStore,
  SupabaseScanRepository
} from "../../../../../../lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      return Response.json(
        failure("SCAN_IMAGE_NOT_FOUND", "The baseline image is unavailable.", false),
        { status: 404 }
      );
    }
    const scan = await new SupabaseScanRepository(actor.client).findById(actor.userId, id);
    if (!scan?.imagePath || !scan.retainImage) {
      return Response.json(
        failure("SCAN_IMAGE_NOT_FOUND", "The retained baseline image was not found.", false),
        { status: 404 }
      );
    }
    const image = await new SupabaseScanImageStore().get(scan.imagePath);
    if (!image) {
      return Response.json(
        failure("SCAN_IMAGE_NOT_FOUND", "The retained baseline image was not found.", false),
        { status: 404 }
      );
    }
    const contentType = scan.imagePath.toLowerCase().endsWith(".png")
      ? "image/png"
      : "image/jpeg";
    return new Response(image.slice().buffer as ArrayBuffer, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, no-store",
        "content-security-policy": "default-src 'none'; sandbox"
      }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(
      failure("PERSISTENCE_UNAVAILABLE", "The baseline image could not be loaded.", true),
      { status: 503 }
    );
  }
}

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
