import {
  insufficientResult,
  persistentDisclaimer,
  seededExperiment
} from "@skincause/domain";
import { success } from "@skincause/server-core";
import {
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const actor = await resolveRequestActor(request);
  const experiment = actor.kind === "authenticated"
    ? await createPersistentWorkspaceService(actor).getExperiment(actor.userId, id)
    : seededExperiment;
  const result = experiment.result ?? insufficientResult;
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new Response(
      `<!doctype html><html><head><title>SkinCause experiment summary</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;color:#102f33;line-height:1.5}h1,h2{font-family:Georgia,serif}section{border-top:1px solid #d4dfdb;padding:20px 0}</style></head><body><h1>${escapeHtml(experiment.name)}</h1><p>${escapeHtml(result.wording)}</p><section><h2>Evidence score</h2><p>${result.score ?? "Not available"}/100 · ${escapeHtml(result.associationLevel)} association</p></section><section><h2>Limitations</h2><ul>${result.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section><p><small>${escapeHtml(persistentDisclaimer)}</small></p></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
  return Response.json(success({
    experimentId: id,
    experiment: { ...experiment, result },
    disclaimer: persistentDisclaimer
  }));
}
