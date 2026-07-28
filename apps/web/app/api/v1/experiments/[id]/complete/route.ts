import { seededResult } from "@skincause/domain";
import { failure, success } from "@skincause/server-core";
import {
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const actor = await resolveRequestActor(request);
  if (actor.kind === "authenticated") {
    const experiment = await createPersistentWorkspaceService(actor).getExperiment(actor.userId, id);
    if (!experiment.result) {
      return Response.json(
        failure("RESULT_NOT_AVAILABLE", "More comparable check-ins are needed.", true),
        { status: 409 }
      );
    }
    return Response.json(success({
      experimentId: id,
      ...experiment.result,
      generatedAt: new Date().toISOString()
    }));
  }
  return Response.json(success({
    experimentId: id,
    ...seededResult,
    generatedAt: new Date().toISOString()
  }));
}
