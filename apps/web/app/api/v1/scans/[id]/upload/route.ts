import { success } from "@skincause/server-core";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await request.arrayBuffer();
  return Response.json(success({ scanId: id, status: "uploaded" }));
}
