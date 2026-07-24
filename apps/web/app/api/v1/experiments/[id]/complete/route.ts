import { seededResult } from "@skincause/domain";
import { success } from "@skincause/server-core";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return Response.json(success({ experimentId: id, ...seededResult, generatedAt: new Date().toISOString() }));
}
