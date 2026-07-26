import { createExperimentSchema } from "@skincause/contracts";
import { seededExperiment } from "@skincause/domain";
import { failure, serverServices, success } from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../lib/route-errors";
import {
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../lib/supabase-server";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const experiments = actor.kind === "authenticated"
      ? await createPersistentWorkspaceService(actor).listExperiments(actor.userId)
      : serverServices.listExperiments();
    return Response.json(success(experiments));
  } catch (error) {
    return persistenceErrorResponse(error, "Experiments are temporarily unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      return Response.json(
        success({ ...seededExperiment, ...body, id: crypto.randomUUID(), status: "active" }),
        { status: 201 }
      );
    }
    const parsed = createExperimentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        failure("VALIDATION_FAILED", "Check the experiment fields and try again.", true),
        { status: 400 }
      );
    }
    const experiment = await createPersistentWorkspaceService(actor).createExperiment(
      actor.userId,
      parsed.data
    );
    return Response.json(success(experiment), { status: 201 });
  } catch (error) {
    return persistenceErrorResponse(error, "The experiment could not be started. Try again.");
  }
}
