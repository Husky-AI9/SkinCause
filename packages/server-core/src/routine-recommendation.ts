import type {
  Experiment,
  Product,
  RoutineRecommendation
} from "@skincause/contracts";
import { routineRecommendationDisclaimer } from "@skincause/domain";
import { z } from "zod";

const PROMPT_VERSION = "routine-recommendation-v3";

const candidateProductSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().min(1).max(120),
  category: z.string().min(1).max(120),
  productUrl: z.string().url().regex(/^https:\/\//i).nullable()
});

const generatedRecommendationSchema = z.object({
  action: z.enum(["remove", "replace", "add", "keep", "no_change"]),
  existingProductId: z.string().nullable(),
  candidateProduct: candidateProductSchema.nullable(),
  summary: z.string().min(1).max(500),
  rationale: z.array(z.string().min(1).max(300)).max(3),
  evidence: z.array(z.string().min(1).max(300)).max(4),
  measurementKeys: z.array(z.string().min(1).max(100)).max(3),
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
            productUrl: { type: ["string", "null"] }
          },
          required: ["name", "brand", "category", "productUrl"]
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
        max_output_tokens: 1200,
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
              "Recommend one cosmetic routine action: remove, replace, add, keep, or no_change.",
              "You may select any supplied existing product for removal or replacement.",
              "For add or replace, web-search and return one real current product candidate; do not invent availability, ingredients, or claims.",
              "Choose up to three measurementKeys only from the supplied experiment primaryConcerns.",
              "Keep the recommendation to one routine change so it can be tested in a controlled experiment.",
              "Do not diagnose, prescribe treatment, claim causation, or establish product safety or suitability.",
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
    if (level === "moderate" || level === "strong") {
      return {
        action: "replace",
        existingProductId: experiment.suspectProductId,
        candidateProduct: {
          name: "Fragrance-free barrier moisturizer",
          brand: "Demo catalog",
          category: "Moisturizer",
          productUrl: null
        },
        summary: `Consider testing one replacement for ${experiment.suspectProductName}.`,
        rationale: ["The repeated measurements moved in the experiment's expected direction."],
        evidence: [
          `${level[0].toUpperCase()}${level.slice(1)} deterministic association`,
          `Visible trend ${experiment.result?.components.imageTrend ?? 0}/100`
        ],
        measurementKeys: experiment.primaryConcerns.slice(0, 3),
        uncertainty: "This demo candidate is not a safety assessment or proof of causation.",
        sources: []
      };
    }
    return {
      action: "add",
      existingProductId: null,
      candidateProduct: {
        name: "Simple hydrating moisturizer",
        brand: "Demo catalog",
        category: "Moisturizer",
        productUrl: null
      },
      summary: "Consider testing one simple routine addition while keeping everything else stable.",
      rationale: ["The current evidence does not support removing a specific routine product."],
      evidence: [
        level === "insufficient"
          ? "The deterministic experiment result is insufficient."
          : "The deterministic experiment result shows a low association."
      ],
      measurementKeys: experiment.primaryConcerns.slice(0, 3),
      uncertainty: "This is a testable hypothesis, not an evidence-backed product conclusion.",
      sources: []
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
  products: Product[]
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
      }))
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
    return (await this.repository.find(ownerId, experimentId))?.recommendation ?? null;
  }

  async generate(ownerId: string, experiment: Experiment, products: Product[]) {
    const context = buildRecommendationContext(experiment, products);
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
    const measurementKeys = [...new Set(safeGenerated.measurementKeys)]
      .filter((key) => context.experiment.primaryConcerns.includes(key))
      .slice(0, 3);
    const candidateProduct = safeGenerated.candidateProduct
      ? {
          ...safeGenerated.candidateProduct,
          productUrl:
            normalizedCandidateUrl && verifiedUrls.has(normalizedCandidateUrl)
              ? normalizedCandidateUrl
              : null
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
