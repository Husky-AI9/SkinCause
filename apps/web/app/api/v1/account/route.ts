import { success } from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../lib/route-errors";
import {
  deleteAuthenticatedAccount,
  resolveRequestActor
} from "../../../../lib/supabase-server";

export async function DELETE(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    if (actor.kind === "authenticated") {
      await deleteAuthenticatedAccount(actor);
    }
    return Response.json(success({ deleted: true, deletionEventStatus: "completed" }));
  } catch (error) {
    return persistenceErrorResponse(error, "The account could not be deleted. Try again.");
  }
}
