import { failure, serverServices, success } from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../../lib/route-errors";
import {
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../../lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await resolveRequestActor(request);
    if (actor.kind === "authenticated") {
      const experiment = await createPersistentWorkspaceService(actor).getExperiment(actor.userId, id);
      return Response.json(success(experiment));
    }
    const experiment = serverServices.getExperiment(id);
    if (!experiment) {
      return Response.json(failure("NOT_FOUND", "Experiment not found.", false), { status: 404 });
    }
    return Response.json(success(experiment));
  } catch (error) {
    return persistenceErrorResponse(error, "The experiment is temporarily unavailable.");
  }
}
