import {
  calculateSkinSimulationParameters,
  scans,
  seededExperiment,
  skinSimulationDisclaimer
} from "@skincause/domain";
import { failure, success } from "@skincause/server-core";
import {
  deleteGuestSkinSimulation,
  generateGuestSkinSimulationImage,
  getGuestSkinSimulation,
  startGuestSkinSimulation
} from "../../../../../../lib/guest-skin-simulation";
import { persistenceErrorResponse } from "../../../../../../lib/route-errors";
import {
  createPersistentSkinSimulationService,
  createPersistentWorkspaceService,
  getExperimentSimulationContext,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

const imagePath = (id: string) =>
  `/api/v1/experiments/${encodeURIComponent(id)}/simulation/image`;

export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (id === seededExperiment.id) return Response.json(success(null));
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      if (process.env.YOUCAM_MOCK_MODE !== "false") return Response.json(success(null));
      return Response.json(success(await getGuestSkinSimulation(id)));
    }
    await createPersistentWorkspaceService(actor).getExperiment(actor.userId, id);
    const service = createPersistentSkinSimulationService(
      actor,
      `${new URL(request.url).origin}/images/demo-face-v3.png`
    );
    const simulation = await service.get(actor.userId, id);
    return Response.json(success(
      simulation?.status === "succeeded"
        ? { ...simulation, imageUrl: imagePath(id) }
        : simulation
    ));
  } catch (error) {
    return persistenceErrorResponse(error, "The skin illustration is temporarily unavailable.");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (id === seededExperiment.id && request.headers.get("content-type") === "image/png") {
      try {
        const sourceImage = new Uint8Array(await request.arrayBuffer());
        if (sourceImage.byteLength === 0 || sourceImage.byteLength >= 4_000_000) {
          return Response.json(
            failure("SIMULATION_SOURCE_INVALID", "The demo source image is invalid.", false),
            { status: 400 }
          );
        }
        const result = await generateGuestSkinSimulationImage(sourceImage, "image/png");
        const generatedAt = new Date();
        return new Response(result.image.slice().buffer as ArrayBuffer, {
          headers: {
            "content-type": result.mimeType,
            "cache-control": "private, no-store",
            "content-security-policy": "default-src 'none'; sandbox",
            "x-skincause-generated-at": generatedAt.toISOString(),
            "x-skincause-expires-at": new Date(
              generatedAt.getTime() + 90 * 60 * 1000
            ).toISOString()
          }
        });
      } catch {
        return Response.json(
          failure(
            "SIMULATION_PROVIDER_FAILED",
            "YouCam could not generate the demo illustration. Try again.",
            true
          ),
          { status: 502 }
        );
      }
    }
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      if (process.env.YOUCAM_MOCK_MODE === "false") {
        const sourceImageUrl = new URL("/images/demo-face-acne.png", request.url).toString();
        return Response.json(success(await startGuestSkinSimulation(id, sourceImageUrl)));
      }
      const now = new Date();
      return Response.json(success({
        experimentId: id,
        status: "succeeded",
        provider: "mock",
        sourceScanId: scans[0].id,
        targetScanId: scans.at(-1)!.id,
        parameters: calculateSkinSimulationParameters(scans[0], scans.at(-1)!),
        imageUrl: "/images/demo-face-v3.png",
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        generatedAt: now.toISOString(),
        disclaimer: skinSimulationDisclaimer
      }));
    }
    const experiment = await createPersistentWorkspaceService(actor)
      .getExperiment(actor.userId, id);
    const simulationContext = await getExperimentSimulationContext(actor, experiment);
    const service = createPersistentSkinSimulationService(
      actor,
      `${new URL(request.url).origin}/images/demo-face-v3.png`
    );
    const simulation = await service.start(actor.userId, simulationContext);
    return Response.json(success(simulation));
  } catch (error) {
    return persistenceErrorResponse(error, "The skin illustration could not be started.");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (id === seededExperiment.id) {
      deleteGuestSkinSimulation();
      return Response.json(success({ experimentId: id, imageDeleted: true }));
    }
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      deleteGuestSkinSimulation();
      return Response.json(success({
        experimentId: id,
        imageDeleted: true
      }));
    }
    await createPersistentWorkspaceService(actor).getExperiment(actor.userId, id);
    const simulation = await createPersistentSkinSimulationService(
      actor,
      `${new URL(request.url).origin}/images/demo-face-v3.png`
    ).delete(actor.userId, id);
    return Response.json(success(simulation));
  } catch (error) {
    return persistenceErrorResponse(error, "The generated image could not be deleted.");
  }
}
