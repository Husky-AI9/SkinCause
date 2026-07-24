import { serverServices, success } from "@skincause/server-core";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return Response.json(success(serverServices.getScan(id)));
}
