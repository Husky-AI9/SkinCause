import { seededExperiment } from "@skincause/domain";
import { serverServices, success } from "@skincause/server-core";

export async function GET() {
  return Response.json(success(serverServices.listExperiments()));
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  return Response.json(success({ ...seededExperiment, ...body, id: crypto.randomUUID(), status: "active" }), { status: 201 });
}
