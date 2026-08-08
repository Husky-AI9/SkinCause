import {
  AI_ACNE_PATTERN_CONCERN_KEY,
  AI_ACNE_SEVERITY_CONCERN_KEY,
  type Concern,
  type Scan
} from "@skincause/contracts";
import { z } from "zod";

const visiblePatternSchema = z.enum([
  "Redness-dominant acne pattern",
  "Pore and texture-dominant acne pattern",
  "Mixed redness, pore, and texture acne pattern",
  "Unclassified visible acne pattern"
]);

const acnePatternAssessmentSchema = z.object({
  severityScore: z.number().int().min(0).max(100),
  visiblePattern: visiblePatternSchema,
  basis: z.string().min(1).max(280)
});

const openAiResponseSchema = z.object({
  status: z.string(),
  output: z.array(z.object({
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      refusal: z.string().optional()
    }).passthrough()).optional()
  }).passthrough())
}).passthrough();

const acnePatternJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    severityScore: { type: "integer", minimum: 0, maximum: 100 },
    visiblePattern: {
      type: "string",
      enum: [
        "Redness-dominant acne pattern",
        "Pore and texture-dominant acne pattern",
        "Mixed redness, pore, and texture acne pattern",
        "Unclassified visible acne pattern"
      ]
    },
    basis: { type: "string" }
  },
  required: ["severityScore", "visiblePattern", "basis"]
} as const;

export type AcnePatternAssessment = z.infer<typeof acnePatternAssessmentSchema>;

export interface AcnePatternAssessmentProvider {
  readonly providerName: "openai" | "mock";
  assess(input: {
    concerns: Concern[];
    idempotencyKey: string;
  }): Promise<AcnePatternAssessment>;
}

function measurementValue(concerns: Concern[], key: string) {
  return concerns.find((concern) => concern.key === key)?.normalizedSeverity ?? null;
}

function sanitizedMeasurements(concerns: Concern[]) {
  return concerns
    .filter((concern) => !concern.key.startsWith("ai_acne_"))
    .map((concern) => ({
      key: concern.key,
      label: concern.displayLabel ?? concern.providerLabel,
      normalizedVisibleSeverity: concern.normalizedSeverity
    }));
}

export class OpenAiAcnePatternAssessmentProvider implements AcnePatternAssessmentProvider {
  readonly providerName = "openai" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-5.6-sol",
    private readonly baseUrl = "https://api.openai.com/v1"
  ) {}

  async assess(input: {
    concerns: Concern[];
    idempotencyKey: string;
  }): Promise<AcnePatternAssessment> {
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
        reasoning: { effort: "low" },
        max_output_tokens: 500,
        input: [
          {
            role: "system",
            content: [
              "Create a non-diagnostic visible acne-pattern assessment from normalized YouCam cosmetic measurements only.",
              "Return one 0-100 severity score where a higher number means a stronger visible acne-related cosmetic signal.",
              "Choose the most specific allowed signal-dominance pattern supported by the supplied measurements and use Unclassified visible acne pattern when the aggregate measurements are insufficient.",
              "Do not diagnose an acne subtype, prescribe treatment, claim causation, or imply medical certainty.",
              "The basis must name the measurements used and plainly state that capture conditions can affect the result."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({ measurements: sanitizedMeasurements(input.concerns) })
          }
        ],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "visible_acne_pattern_assessment",
            strict: true,
            schema: acnePatternJsonSchema
          }
        }
      })
    });
    if (!response.ok) throw new Error("OPENAI_ACNE_ASSESSMENT_FAILED");
    const payload = openAiResponseSchema.safeParse(await response.json());
    if (!payload.success || payload.data.status !== "completed") {
      throw new Error("OPENAI_ACNE_ASSESSMENT_INCOMPLETE");
    }
    const content = payload.data.output.flatMap((item) => item.content ?? []);
    if (content.some((item) => item.type === "refusal")) {
      throw new Error("OPENAI_ACNE_ASSESSMENT_REFUSED");
    }
    const outputText = content.find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("OPENAI_ACNE_ASSESSMENT_EMPTY");
    try {
      return acnePatternAssessmentSchema.parse(JSON.parse(outputText));
    } catch {
      throw new Error("OPENAI_ACNE_ASSESSMENT_SCHEMA_CHANGED");
    }
  }
}

export class MockAcnePatternAssessmentProvider implements AcnePatternAssessmentProvider {
  readonly providerName = "mock" as const;

  async assess(input: { concerns: Concern[] }): Promise<AcnePatternAssessment> {
    const blemish = measurementValue(input.concerns, "blemish_pattern") ?? 0;
    const redness = measurementValue(input.concerns, "redness") ?? 0;
    const texture = measurementValue(input.concerns, "texture") ?? 0;
    const pores = measurementValue(input.concerns, "pores") ?? 0;
    const severityScore = Math.round(
      Math.min(100, Math.max(0, blemish * 0.65 + redness * 0.2 + texture * 0.1 + pores * 0.05))
    );
    const poreTextureSignal = Math.max(pores, texture);
    const visiblePattern = blemish === 0
      ? "Unclassified visible acne pattern" as const
      : redness - poreTextureSignal >= 12
        ? "Redness-dominant acne pattern" as const
        : poreTextureSignal - redness >= 12
          ? "Pore and texture-dominant acne pattern" as const
          : "Mixed redness, pore, and texture acne pattern" as const;
    return {
      severityScore,
      visiblePattern,
      basis: "Deterministic demo assessment derived from visible blemish, redness, texture, and pore measurements; capture conditions can affect the result."
    };
  }
}

export function appendAcnePatternAssessment(
  scan: Scan,
  assessment: AcnePatternAssessment
): Scan {
  const concerns = scan.concerns.filter(
    (concern) =>
      concern.key !== AI_ACNE_SEVERITY_CONCERN_KEY &&
      concern.key !== AI_ACNE_PATTERN_CONCERN_KEY
  );
  return {
    ...scan,
    concerns: [
      ...concerns,
      {
        key: AI_ACNE_SEVERITY_CONCERN_KEY,
        providerLabel: "AI visible acne-pattern severity",
        displayLabel: "Acne severity",
        rawScore: assessment.severityScore,
        uiScore: assessment.severityScore,
        normalizedSeverity: assessment.severityScore,
        directionSource: "configured",
        experimentRole: "primary"
      },
      {
        key: AI_ACNE_PATTERN_CONCERN_KEY,
        providerLabel: "AI observed blemish pattern",
        displayLabel: assessment.visiblePattern,
        rawScore: null,
        uiScore: null,
        normalizedSeverity: null,
        directionSource: "unknown",
        experimentRole: "context"
      }
    ]
  };
}
