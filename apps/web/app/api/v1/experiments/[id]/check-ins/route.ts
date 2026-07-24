import { success } from "@skincause/server-core";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  return Response.json(success({ id: crypto.randomUUID(), experimentId: id, ...body, occurredAt: new Date().toISOString() }), { status: 201 });
}
