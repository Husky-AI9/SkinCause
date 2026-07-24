import { serverServices, success } from "@skincause/server-core";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const product = serverServices.listProducts().find((item) => item.id === id);
  return Response.json(success({ ...product, ...body, id, historyAppended: true }));
}
