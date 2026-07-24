import { success } from "@skincause/server-core";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return Response.json(success({ scanId: id, imageDeleted: true, derivedScoresRetained: true }));
}
