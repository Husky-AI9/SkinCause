import {
  routineRecommendationSchema,
  type Experiment,
  type Product,
  type RoutineRecommendation
} from "@skincause/contracts";
import {
  acneNutritionGuardrails,
  defaultAcneGuidancePreferences,
  routineRecommendationDisclaimer
} from "@skincause/domain";
import { z } from "zod";

const PROMPT_VERSION = "acne-guidance-v4-product-image";

const candidateProductSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().min(1).max(120),
  category: z.string().min(1).max(120),
  productUrl: z.string().url().regex(/^https:\/\//i).nullable(),
  imageUrl: z.string().url().regex(/^https:\/\//i).nullable(),
  estimatedPrice: z.string().min(1).max(80).nullable(),
  packageSize: z.string().min(1).max(80).nullable(),
  pricePerUnit: z.string().min(1).max(100).nullable(),
  priceCheckedAt: z.string().datetime().nullable(),
  localAvailability: z.string().min(1).max(200).nullable(),
  affordabilityNote: z.string().min(1).max(300).nullable(),
  keyIngredients: z.array(z.string().min(1).max(100)).max(4),
  usageNote: z.string().min(1).max(300).nullable(),
  lowerCostAlternative: z.string().min(1).max(200).nullable()
});

const generatedRecommendationSchema = z.object({
  action: z.enum(["remove", "replace", "add", "keep", "no_change"]),
  existingProductId: z.string().nullable(),
  candidateProduct: candidateProductSchema.nullable(),
  summary: z.string().min(1).max(500),
  rationale: z.array(z.string().min(1).max(300)).max(3),
  evidence: z.array(z.string().min(1).max(300)).max(4),
  measurementKeys: z.array(z.string().min(1).max(100)).max(3),
  nutritionGuidance: z.object({
    focus: z.string().min(1).max(120),
    suggestion: z.string().min(1).max(400),
    foodsToConsider: z.array(z.string().min(1).max(120)).min(1).max(4),
    evidenceNote: z.string().min(1).max(400),
    trackingPrompt: z.string().min(1).max(300)
  }),
  uncertainty: z.string().min(1).max(500)
});

const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional()
}).passthrough();

const openAiResponseSchema = z.object({
  status: z.string(),
  model: z.string(),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      refusal: z.string().optional(),
      annotations: z.array(z.object({
        type: z.string(),
        url: z.string().url().optional(),
        title: z.string().optional()
      }).passthrough()).optional()
    }).passthrough()).optional(),
    action: z.object({
      sources: z.array(sourceSchema).optional()
    }).passthrough().optional()
  }).passthrough())
}).passthrough();

const recommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: ["remove", "replace", "add", "keep", "no_change"]
    },
    existingProductId: {
      type: ["string", "null"]
    },
    candidateProduct: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            brand: { type: "string" },
            category: { type: "string" },
            productUrl: { type: ["string", "null"] },
            imageUrl: { type: ["string", "null"] },
            estimatedPrice: { type: ["string", "null"] },
            packageSize: { type: ["string", "null"] },
            pricePerUnit: { type: ["string", "null"] },
            priceCheckedAt: { type: ["string", "null"] },
            localAvailability: { type: ["string", "null"] },
            affordabilityNote: { type: ["string", "null"] },
            keyIngredients: {
              type: "array",
              items: { type: "string" },
              maxItems: 4
            },
            usageNote: { type: ["string", "null"] },
            lowerCostAlternative: { type: ["string", "null"] }
          },
          required: [
            "name",
            "brand",
            "category",
            "productUrl",
            "imageUrl",
            "estimatedPrice",
            "packageSize",
            "pricePerUnit",
            "priceCheckedAt",
            "localAvailability",
            "affordabilityNote",
            "keyIngredients",
            "usageNote",
            "lowerCostAlternative"
          ]
        },
        { type: "null" }
      ]
    },
    summary: { type: "string" },
    rationale: {
      type: "array",
      items: { type: "string" },
      maxItems: 3
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      maxItems: 4
    },
    measurementKeys: {
      type: "array",
      items: { type: "string" },
      maxItems: 3
    },
    nutritionGuidance: {
      type: "object",
      additionalProperties: false,
      properties: {
        focus: { type: "string" },
        suggestion: { type: "string" },
        foodsToConsider: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 4
        },
        evidenceNote: { type: "string" },
        trackingPrompt: { type: "string" }
      },
      required: ["focus", "suggestion", "foodsToConsider", "evidenceNote", "trackingPrompt"]
    },
    uncertainty: { type: "string" }
  },
  required: [
    "action",
    "existingProductId",
    "candidateProduct",
    "summary",
    "rationale",
    "evidence",
    "measurementKeys",
    "nutritionGuidance",
    "uncertainty"
  ]
} as const;

export type RecommendationEvidenceContext = {
  experiment: {
    id: string;
    type: Experiment["type"];
    status: string;
    suspectProductId: string;
    suspectProductName: string;
    primaryConcerns: string[];
    result: Experiment["result"] | null;
  };
  products: Array<Pick<Product, "id" | "name" | "category" | "active" | "recentlyChanged">>;
  guidancePreferences: {
    market: string;
    maxUnitPriceUsd: number;
    priceVerificationDate: string;
    priorities: string[];
    nutritionGuardrails: string[];
  };
};

export type GeneratedRoutineRecommendation = z.infer<typeof generatedRecommendationSchema> & {
  sources: Array<{ title: string; url: string }>;
};

export interface RoutineRecommendationProvider {
  readonly providerName: "openai" | "mock";
  readonly model: string;
  generate(input: {
    context: RecommendationEvidenceContext;
    idempotencyKey: string;
    safetyIdentifier: string;
  }): Promise<GeneratedRoutineRecommendation>;
}

function normalizeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function safeSources(payload: z.infer<typeof openAiResponseSchema>) {
  const candidates = payload.output.flatMap((item) => [
    ...(item.action?.sources ?? []),
    ...(item.content ?? []).flatMap((content) =>
      (content.annotations ?? []).flatMap((annotation) =>
        annotation.url ? [{ url: annotation.url, title: annotation.title }] : []
      )
    )
  ]);
  const unique = new Map<string, { title: string; url: string }>();
  for (const candidate of candidates) {
    const normalizedUrl = normalizeHttpsUrl(candidate.url);
    if (!normalizedUrl) continue;
    const url = new URL(normalizedUrl);
    unique.set(normalizedUrl, {
      title: candidate.title?.trim() || url.hostname,
      url: normalizedUrl
    });
  }
  return [...unique.values()].slice(0, 8);
}

export class OpenAiRoutineRecommendationProvider implements RoutineRecommendationProvider {
  readonly providerName = "openai" as const;

  constructor(
    private readonly apiKey: string,
    readonly model = "gpt-5.6-sol",
    private readonly baseUrl = "https://api.openai.com/v1"
  ) {}

  async generate(input: {
    context: RecommendationEvidenceContext;
    idempotencyKey: string;
    safetyIdentifier: string;
  }): Promise<GeneratedRoutineRecommendation> {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is required when mock mode is disabled.");
    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        safety_identifier: input.safetyIdentifier,
        reasoning: { effort: "low" },
        max_output_tokens: 1600,
        tools: [{
          type: "web_search",
          search_context_size: "low"
        }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        input: [
          {
            role: "system",
            content: [
              "Create one acne-focused cosmetic routine action: remove, replace, add, keep, or no_change.",
              "You may select any supplied existing product for removal or replacement.",
              "Prioritize the visible acne or blemish measurement when it is available; use oiliness, redness, pores, and texture only as supporting cosmetic signals.",
              "For add or replace, web-search and return one real current non-prescription product candidate that fits the supplied budget and market.",
              "The candidate must include a direct HTTPS manufacturer or established-retailer product page that a user can open to verify or purchase it.",
              "For add or replace, also return a direct HTTPS image URL showing that exact candidate product when the manufacturer or established retailer exposes one on the verified product page. Prefer an image hosted on the same domain as the product page. Return null instead of guessing, returning a search result, or returning another product's image.",
              "Use current product or retailer sources for price, availability, and label claims; include the exact candidate product URL in the returned web sources and return null for price or availability when those facts cannot be verified.",
              "Use guidancePreferences.priceVerificationDate as the price-check date and return its UTC date at noon in priceCheckedAt.",
              "For a candidate, return package size, a calculated price-per-ounce or price-per-milliliter when the cited facts support it, the current ISO timestamp in priceCheckedAt, up to four label-verified key ingredients, a cautious label-aligned usage note, and one lower-cost alternative when verifiable. Return null rather than guessing.",
              "Prefer simple, widely available, acne-friendly routine categories and avoid recommending prescription products.",
              "Choose up to three measurementKeys only from the supplied experiment primaryConcerns.",
              "Keep the recommendation to one routine change so it can be tested in a controlled experiment.",
              "Also return two to four specific, ordinary foods the user could consider eating, supported by a reputable dermatology or public-health source.",
              "Prefer balanced lower-glycemic examples such as vegetables, beans, intact oats, or fruit when supported by the source.",
              "Nutrition guidance must be an optional observation or balanced-food habit, never a supplement, fasting plan, restrictive elimination diet, or replacement for professional care.",
              "Do not diagnose acne, prescribe treatment, claim causation, promise improvement, or establish product safety or suitability.",
              "When experiment evidence is insufficient, clearly identify the recommendation as a hypothesis to test rather than an evidence-backed conclusion.",
              "Never change the user's routine automatically."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify(input.context)
          }
        ],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "routine_recommendation",
            strict: true,
            schema: recommendationJsonSchema
          }
        }
      })
    });
    if (!response.ok) throw new Error("OPENAI_RECOMMENDATION_FAILED");
    const payload = openAiResponseSchema.safeParse(await response.json());
    if (!payload.success || payload.data.status !== "completed") {
      throw new Error("OPENAI_RECOMMENDATION_INCOMPLETE");
    }
    const content = payload.data.output.flatMap((item) => item.content ?? []);
    if (content.some((item) => item.type === "refusal")) {
      throw new Error("OPENAI_RECOMMENDATION_REFUSED");
    }
    const outputText = content.find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("OPENAI_RECOMMENDATION_EMPTY");
    let json: unknown;
    try {
      json = JSON.parse(outputText);
    } catch {
      throw new Error("OPENAI_RECOMMENDATION_SCHEMA_CHANGED");
    }
    const parsed = generatedRecommendationSchema.safeParse(json);
    if (!parsed.success) throw new Error("OPENAI_RECOMMENDATION_SCHEMA_CHANGED");
    return {
      ...parsed.data,
      sources: safeSources(payload.data)
    };
  }
}

export class MockRoutineRecommendationProvider implements RoutineRecommendationProvider {
  readonly providerName = "mock" as const;
  readonly model = "deterministic-routine-v2";

  async generate(input: {
    context: RecommendationEvidenceContext;
  }): Promise<GeneratedRoutineRecommendation> {
    const experiment = input.context.experiment;
    const level = experiment.result?.associationLevel ?? "insufficient";
    const budgetUsd = input.context.guidancePreferences.maxUnitPriceUsd;
    if (budgetUsd < 13.99) {
      return {
        action: "no_change",
        existingProductId: null,
        candidateProduct: null,
        summary: `Keep the routine stable because this demo has no source-verified candidate within the $${budgetUsd.toFixed(2)} budget.`,
        rationale: ["A product should not be suggested when its verified price exceeds the selected budget."],
        evidence: ["The budget remains part of the experiment evidence and recommendation context."],
        measurementKeys: experiment.primaryConcerns.slice(0, 3),
        nutritionGuidance: {
          focus: "Nutrition is context, not a conclusion",
          suggestion: "Keep meals broadly consistent while this product budget is reconsidered.",
          foodsToConsider: ["Fresh vegetables", "Beans or lentils", "Steel-cut oats"],
          evidenceNote: "Research on diet and acne is mixed, so nutrition should remain a tracked context variable.",
          trackingPrompt: "Did your meal pattern change since the last scan?"
        },
        uncertainty: "No product was selected because the verified demo price was above the chosen budget.",
        sources: [
          {
            title: "American Academy of Dermatology: Skin care on a budget",
            url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-budget"
          }
        ]
      };
    }
    if (level === "moderate" || level === "strong") {
      return {
        action: "replace",
        existingProductId: experiment.suspectProductId,
        candidateProduct: {
          name: "Daily Facial Moisturizer",
          brand: "Vanicream",
          category: "Moisturizer",
          productUrl: "https://www.target.com/p/-/A-80038093",
          imageUrl: "https://www.vanicream.com/dynamic-media/product/images/dfm-gp24c-group-2661-ret-crop.jpg?gravity=center&k=4OmHIlIodbwJrIiLYPDUGg&v=galleryMedia",
          estimatedPrice: "$13.99 at Target when checked",
          packageSize: "3 fl oz (89 mL)",
          pricePerUnit: "$4.66 per fl oz",
          priceCheckedAt: "2026-08-07T12:00:00.000Z",
          localAvailability: "Listed in stock online; local availability may vary",
          affordabilityNote: `A source-verified demo candidate within the $${budgetUsd.toFixed(2)} limit; verify the current price and label before buying.`,
          keyIngredients: ["Hyaluronic acid", "Ceramides", "Squalane"],
          usageNote: "Patch test first and introduce only this product while the experiment runs; follow the product label.",
          lowerCostAlternative: "Keep the current moisturizer if a replacement is not needed or the current price cannot be verified."
        },
        summary: `Consider testing one replacement for ${experiment.suspectProductName}.`,
        rationale: ["The repeated measurements moved in the experiment's expected direction."],
        evidence: [
          `${level[0].toUpperCase()}${level.slice(1)} deterministic association`,
          `Visible trend ${experiment.result?.components.imageTrend ?? 0}/100`
        ],
        measurementKeys: experiment.primaryConcerns.slice(0, 3),
        nutritionGuidance: {
          focus: "Keep food changes observable",
          suggestion: "Consider adding one lower-glycemic food at a time while keeping the rest of your meals broadly consistent.",
          foodsToConsider: ["Fresh vegetables", "Beans or lentils", "Steel-cut oats"],
          evidenceNote: "Diet may be associated with acne for some people, but evidence varies and does not prove that a food caused this pattern.",
          trackingPrompt: "Which suggested food did you eat consistently since the last scan, if any?"
        },
        uncertainty: "This demo candidate is not a safety assessment or proof of causation.",
        sources: [
          {
            title: "American Academy of Dermatology: Can the right diet get rid of acne?",
            url: "https://www.aad.org/public/diseases/acne/causes/diet"
          },
          {
            title: "American Academy of Dermatology: Skin care on a budget",
            url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-budget"
          },
          {
            title: "Target: Vanicream Daily Facial Moisturizer",
            url: "https://www.target.com/p/-/A-80038093"
          },
          {
            title: "Vanicream: Daily Facial Moisturizer",
            url: "https://www.vanicream.com/product/vanicream-daily-facial-moisturizer"
          }
        ]
      };
    }
    return {
      action: "add",
      existingProductId: null,
      candidateProduct: {
        name: "Daily Facial Moisturizer",
        brand: "Vanicream",
        category: "Moisturizer",
        productUrl: "https://www.target.com/p/-/A-80038093",
        imageUrl: "https://www.vanicream.com/dynamic-media/product/images/dfm-gp24c-group-2661-ret-crop.jpg?gravity=center&k=4OmHIlIodbwJrIiLYPDUGg&v=galleryMedia",
        estimatedPrice: "$13.99 at Target when checked",
        packageSize: "3 fl oz (89 mL)",
        pricePerUnit: "$4.66 per fl oz",
        priceCheckedAt: "2026-08-07T12:00:00.000Z",
        localAvailability: "Listed in stock online; local availability may vary",
        affordabilityNote: `A source-verified demo candidate within the $${budgetUsd.toFixed(2)} limit; verify the current price and label before buying.`,
        keyIngredients: ["Hyaluronic acid", "Ceramides", "Squalane"],
        usageNote: "Patch test first and introduce only this product while the experiment runs; follow the product label.",
        lowerCostAlternative: "Keep the current moisturizer if a replacement is not needed or the current price cannot be verified."
      },
      summary: "Consider testing one simple routine addition while keeping everything else stable.",
      rationale: ["The current evidence does not support removing a specific routine product."],
      evidence: [
        level === "insufficient"
          ? "The deterministic experiment result is insufficient."
          : "The deterministic experiment result shows a low association."
      ],
      measurementKeys: experiment.primaryConcerns.slice(0, 3),
      nutritionGuidance: {
        focus: "Nutrition is context, not a conclusion",
        suggestion: "Consider adding one lower-glycemic food at a time and log it instead of removing several foods.",
        foodsToConsider: ["Fresh vegetables", "Beans or lentils", "Steel-cut oats"],
        evidenceNote: "Research on diet and acne is mixed, so nutrition should remain a tracked context variable.",
        trackingPrompt: "Which suggested food did you eat consistently since the last scan, if any?"
      },
      uncertainty: "This is a testable hypothesis, not an evidence-backed product conclusion.",
      sources: [
        {
          title: "American Academy of Dermatology: Can the right diet get rid of acne?",
          url: "https://www.aad.org/public/diseases/acne/causes/diet"
        },
        {
          title: "American Academy of Dermatology: Skin care on a budget",
          url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-budget"
        },
        {
          title: "Target: Vanicream Daily Facial Moisturizer",
          url: "https://www.target.com/p/-/A-80038093"
        },
        {
          title: "Vanicream: Daily Facial Moisturizer",
          url: "https://www.vanicream.com/product/vanicream-daily-facial-moisturizer"
        }
      ]
    };
  }
}

export type StoredRoutineRecommendation = {
  ownerId: string;
  experimentId: string;
  inputHash: string;
  recommendation: RoutineRecommendation;
};

export interface RoutineRecommendationRepository {
  find(ownerId: string, experimentId: string): Promise<StoredRoutineRecommendation | null>;
  upsert(record: StoredRoutineRecommendation): Promise<StoredRoutineRecommendation>;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildRecommendationContext(
  experiment: Experiment,
  products: Product[],
  maxUnitPriceUsd: number = defaultAcneGuidancePreferences.maxUnitPriceUsd
): RecommendationEvidenceContext {
  return {
    experiment: {
      id: experiment.id,
      type: experiment.type,
      status: experiment.status,
      suspectProductId: experiment.suspectProductId,
      suspectProductName: experiment.suspectProductName,
      primaryConcerns: experiment.primaryConcerns ?? [],
      result: experiment.result ?? null
    },
    products: [...products]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, name, category, active, recentlyChanged }) => ({
        id,
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
}

function structurallyValid(
  generated: GeneratedRoutineRecommendation,
  products: Product[]
) {
  const hasExisting = generated.existingProductId !== null &&
    products.some((product) => product.id === generated.existingProductId);
  const hasCandidate = generated.candidateProduct !== null;
  if (generated.action === "remove" || generated.action === "keep") {
    return hasExisting && !hasCandidate;
  }
  if (generated.action === "replace") return hasExisting && hasCandidate;
  if (generated.action === "add") return generated.existingProductId === null && hasCandidate;
  return generated.existingProductId === null && !hasCandidate;
}

function safeNoChange(
  generated: GeneratedRoutineRecommendation
): GeneratedRoutineRecommendation {
  return {
    action: "no_change",
    existingProductId: null,
    candidateProduct: null,
    summary: "Keep the routine stable because the generated action could not be verified.",
    rationale: generated.rationale.slice(0, 3),
    evidence: generated.evidence.slice(0, 4),
    measurementKeys: generated.measurementKeys.slice(0, 3),
    nutritionGuidance: generated.nutritionGuidance,
    uncertainty: "The proposed product combination did not satisfy the one-change validation rules.",
    sources: generated.sources
  };
}

export class PersistentRoutineRecommendationService {
  constructor(
    private readonly repository: RoutineRecommendationRepository,
    private readonly provider: RoutineRecommendationProvider
  ) {}

  async get(ownerId: string, experimentId: string) {
    const stored = await this.repository.find(ownerId, experimentId);
    if (!stored) return null;
    const parsed = routineRecommendationSchema.safeParse(stored.recommendation);
    return parsed.success ? parsed.data : null;
  }

  async generate(
    ownerId: string,
    experiment: Experiment,
    products: Product[],
    maxUnitPriceUsd: number = defaultAcneGuidancePreferences.maxUnitPriceUsd
  ) {
    const context = buildRecommendationContext(experiment, products, maxUnitPriceUsd);
    const inputHash = await sha256(JSON.stringify({
      promptVersion: PROMPT_VERSION,
      model: this.provider.model,
      context
    }));
    const existing = await this.repository.find(ownerId, experiment.id);
    if (existing?.inputHash === inputHash) return existing.recommendation;

    const generated = await this.provider.generate({
      context,
      idempotencyKey: inputHash,
      safetyIdentifier: await sha256(`skincause:${ownerId}`)
    });
    const safeGenerated = structurallyValid(generated, products)
      ? generated
      : safeNoChange(generated);
    const verifiedUrls = new Set(safeGenerated.sources.map((source) => source.url));
    const normalizedCandidateUrl = safeGenerated.candidateProduct?.productUrl
      ? normalizeHttpsUrl(safeGenerated.candidateProduct.productUrl)
      : null;
    const normalizedCandidateImageUrl = safeGenerated.candidateProduct?.imageUrl
      ? normalizeHttpsUrl(safeGenerated.candidateProduct.imageUrl)
      : null;
    const measurementKeys = [...new Set(safeGenerated.measurementKeys)]
      .filter((key) => context.experiment.primaryConcerns.includes(key))
      .slice(0, 3);
    const candidateSourceVerified = Boolean(
      normalizedCandidateUrl && verifiedUrls.has(normalizedCandidateUrl)
    );
    const verifiedSourceHosts = new Set(
      [...verifiedUrls].map((url) => new URL(url).hostname.toLowerCase())
    );
    const candidateImageHostVerified = Boolean(
      normalizedCandidateImageUrl &&
      verifiedSourceHosts.has(new URL(normalizedCandidateImageUrl).hostname.toLowerCase())
    );
    const candidateProduct = safeGenerated.candidateProduct
      ? candidateSourceVerified
        ? {
            ...safeGenerated.candidateProduct,
            productUrl: normalizedCandidateUrl,
            imageUrl: candidateImageHostVerified ? normalizedCandidateImageUrl : null
          }
        : {
            ...safeGenerated.candidateProduct,
            productUrl: null,
            imageUrl: null,
            estimatedPrice: null,
            packageSize: null,
            pricePerUnit: null,
            priceCheckedAt: null,
            localAvailability: null,
            affordabilityNote: null,
            keyIngredients: [],
            usageNote: null,
            lowerCostAlternative: null
          }
      : null;
    const recommendation: RoutineRecommendation = {
      experimentId: experiment.id,
      model: this.provider.model,
      generatedAt: new Date().toISOString(),
      ...safeGenerated,
      candidateProduct,
      measurementKeys,
      existingProductName: safeGenerated.existingProductId
        ? products.find((product) => product.id === safeGenerated.existingProductId)?.name ?? null
        : null,
      disclaimer: routineRecommendationDisclaimer
    };
    await this.repository.upsert({
      ownerId,
      experimentId: experiment.id,
      inputHash,
      recommendation
    });
    return recommendation;
  }
}
