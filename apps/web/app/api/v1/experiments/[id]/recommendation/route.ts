import { routineRecommendationDisclaimer, products, seededExperiment } from "@skincause/domain";
import {
  MockRoutineRecommendationProvider,
  success,
  type RecommendationEvidenceContext
} from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../../../lib/route-errors";
import {
  createPersistentRoutineRecommendationService,
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") return Response.json(success(null));
    await createPersistentWorkspaceService(actor).getExperiment(actor.userId, id);
    const recommendation = await createPersistentRoutineRecommendationService(actor)
      .get(actor.userId, id);
    return Response.json(success(recommendation));
  } catch (error) {
    return persistenceErrorResponse(error, "The routine suggestion is temporarily unavailable.");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") {
      const provider = new MockRoutineRecommendationProvider();
      const guestContext: RecommendationEvidenceContext = {
        experiment: {
          id,
          type: seededExperiment.type,
          status: seededExperiment.status,
          suspectProductId: seededExperiment.suspectProductId,
          suspectProductName: "Brightening Serum",
          primaryConcerns: ["redness", "texture"],
          result: seededExperiment.result
        },
        products: products.map(({ id: productId, name, category, active, recentlyChanged }) => ({
          id: productId,
          name,
          category,
          active,
          recentlyChanged
        }))
      };
      const generated = await provider.generate({
        context: guestContext
      });
      const existingProductName = generated.existingProductId
        ? products.find((product) => product.id === generated.existingProductId)?.name ?? null
        : null;
      return Response.json(success({
        experimentId: id,
        model: provider.model,
        generatedAt: new Date().toISOString(),
        ...generated,
        existingProductName,
        disclaimer: routineRecommendationDisclaimer
      }));
    }
    const workspace = createPersistentWorkspaceService(actor);
    const [experiment, routineProducts] = await Promise.all([
      workspace.getExperiment(actor.userId, id),
      workspace.listProducts(actor.userId)
    ]);
    const recommendation = await createPersistentRoutineRecommendationService(actor)
      .generate(actor.userId, experiment, routineProducts);
    return Response.json(success(recommendation));
  } catch (error) {
    return persistenceErrorResponse(error, "The routine suggestion could not be generated.");
  }
}
