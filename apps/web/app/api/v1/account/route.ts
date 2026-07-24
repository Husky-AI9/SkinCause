import { success } from "@skincause/server-core";

export async function DELETE() {
  return Response.json(success({ deleted: true, deletionEventStatus: "completed" }));
}
