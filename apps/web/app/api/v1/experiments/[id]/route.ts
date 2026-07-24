import { failure, serverServices, success } from "@skincause/server-core";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const experiment = serverServices.getExperiment(id);
  if (!experiment) {
    return Response.json(failure("NOT_FOUND", "Experiment not found.", false), { status: 404 });
  }
  return Response.json(success(experiment));
}
