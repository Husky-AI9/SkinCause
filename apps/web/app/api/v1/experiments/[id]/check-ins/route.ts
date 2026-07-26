import { createCheckInSchema } from "@skincause/contracts";
import { failure, success } from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../../../lib/route-errors";
import {
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      return Response.json(
        success({ id: crypto.randomUUID(), experimentId: id, ...body, occurredAt: new Date().toISOString() }),
        { status: 201 }
      );
    }
    const parsed = createCheckInSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        failure("VALIDATION_FAILED", "Check the check-in fields and try again.", true),
        { status: 400 }
      );
    }
    const checkIn = await createPersistentWorkspaceService(actor).createCheckIn(
      actor.userId,
      id,
      parsed.data
    );
    return Response.json(success(checkIn), { status: 201 });
  } catch (error) {
    return persistenceErrorResponse(error, "The check-in could not be saved. Try again.");
  }
}
