import { calculateSkinSimulationParameters, scans, skinSimulationDisclaimer } from "@skincause/domain";
import { success } from "@skincause/server-core";
import {
  deleteGuestSkinSimulation,
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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      if (process.env.YOUCAM_MOCK_MODE === "false") {
        const sourceImageUrl = new URL("/images/demo-face-v3.png", request.url).toString();
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
