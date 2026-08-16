import {
  routineRecommendationRequestSchema,
  type Experiment
} from "@skincause/contracts";
import {
  acneNutritionGuardrails,
  defaultAcneGuidancePreferences,
  routineRecommendationDisclaimer,
  products,
  seededExperiment
} from "@skincause/domain";
import {
  MockRoutineRecommendationProvider,
  PersistentRoutineRecommendationService,
  failure,
  success,
  type RecommendationEvidenceContext,
  type RoutineRecommendationRepository,
  type StoredRoutineRecommendation
} from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../../../lib/route-errors";
import {
  createPersistentRoutineRecommendationService,
  createPersistentWorkspaceService,
  createRoutineRecommendationProvider,
  resolveRequestActor
} from "../../../../../../lib/supabase-server";

export const maxDuration = 60;

class RequestRecommendationRepository implements RoutineRecommendationRepository {
  private record: StoredRoutineRecommendation | null = null;

  async find(ownerId: string, experimentId: string) {
    return this.record?.ownerId === ownerId && this.record.experimentId === experimentId
      ? this.record
      : null;
  }

  async upsert(record: StoredRoutineRecommendation) {
    this.record = record;
    return record;
  }
}

const demoExperiment: Experiment = {
  id: seededExperiment.id,
  name: seededExperiment.name,
  type: seededExperiment.type,
  status: seededExperiment.status,
  startedAt: seededExperiment.startedAt,
  endedAt: seededExperiment.endedAt,
  suspectProductId: seededExperiment.suspectProductId,
  suspectProductName: seededExperiment.suspectProductName,
  hypothesis: seededExperiment.hypothesis,
  baselineScanId: seededExperiment.baselineScanId,
  analysisProfileVersion: seededExperiment.analysisProfileVersion,
  primaryConcerns: [...seededExperiment.primaryConcerns],
  checkIns: [],
  result: seededExperiment.result
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (id === seededExperiment.id) return Response.json(success(null));
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
    const parsed = routineRecommendationRequestSchema.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      return Response.json(
        failure("VALIDATION_FAILED", "Enter a product budget between $1 and $500.", true),
        { status: 400 }
      );
    }
    const maxUnitPriceUsd =
      parsed.data.maxUnitPriceUsd ?? defaultAcneGuidancePreferences.maxUnitPriceUsd;
    if (id === seededExperiment.id) {
      const repository = new RequestRecommendationRepository();
      let recommendation;
      try {
        recommendation = await new PersistentRoutineRecommendationService(
          repository,
          createRoutineRecommendationProvider()
        ).generate("seeded-demo", demoExperiment, products, maxUnitPriceUsd);
      } catch {
        recommendation = await new PersistentRoutineRecommendationService(
          repository,
          new MockRoutineRecommendationProvider()
        ).generate("seeded-demo", demoExperiment, products, maxUnitPriceUsd);
      }
      return Response.json(success(recommendation));
    }
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
          primaryConcerns: [...seededExperiment.primaryConcerns],
          result: seededExperiment.result
        },
        products: products.map(({ id: productId, name, category, active, recentlyChanged }) => ({
          id: productId,
          name,
          category,
          active,
          recentlyChanged
        })),
        guidancePreferences: {
          market: defaultAcneGuidancePreferences.market,
          maxUnitPriceUsd,
          priceVerificationDate: new Date().toISOString().slice(0, 10),
          priorities: [...defaultAcneGuidancePreferences.priorities],
          nutritionGuardrails: [...acneNutritionGuardrails]
        }
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
      .generate(actor.userId, experiment, routineProducts, maxUnitPriceUsd);
    return Response.json(success(recommendation));
  } catch (error) {
    return persistenceErrorResponse(error, "The routine suggestion could not be generated.");
  }
}
