import { failure } from "@skincause/server-core";
import { readGuestSkinSimulationImage } from "../../../../../../../lib/guest-skin-simulation";
import { persistenceErrorResponse } from "../../../../../../../lib/route-errors";
import {
  createPersistentSkinSimulationService,
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../../../../lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      const guestImage = readGuestSkinSimulationImage();
      if (!guestImage) {
        return Response.json(
          failure("SIMULATION_IMAGE_NOT_FOUND", "The demo image is unavailable or expired.", false),
          { status: 404 }
        );
      }
      return new Response(guestImage.image.slice().buffer as ArrayBuffer, {
        headers: {
          "content-type": guestImage.mimeType,
          "cache-control": "private, no-store",
          "content-security-policy": "default-src 'none'; sandbox"
        }
      });
    }
    await createPersistentWorkspaceService(actor).getExperiment(actor.userId, id);
    const result = await createPersistentSkinSimulationService(
      actor,
      `${new URL(request.url).origin}/images/demo-face-v3.png`
    ).readImage(actor.userId, id);
    if (!result) {
      return Response.json(
        failure("SIMULATION_IMAGE_NOT_FOUND", "The generated image is unavailable or expired.", false),
        { status: 404 }
      );
    }
    return new Response(result.image.slice().buffer as ArrayBuffer, {
      headers: {
        "content-type": result.mimeType,
        "cache-control": "private, no-store",
        "content-security-policy": "default-src 'none'; sandbox"
      }
    });
  } catch (error) {
    return persistenceErrorResponse(error, "The generated image is temporarily unavailable.");
  }
}
