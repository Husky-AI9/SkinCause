import type { Experiment } from "@skincause/contracts";
import { products, seededResult } from "@skincause/domain";
import {
  OpenAiRoutineRecommendationProvider,
  buildRecommendationContext
} from "@skincause/server-core";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

const experiment: Experiment = {
  id: "experiment-id",
  name: "Serum elimination",
  type: "elimination",
  status: "completed",
  startedAt: "2026-07-01T08:00:00.000Z",
  endedAt: "2026-07-14T08:00:00.000Z",
  suspectProductId: products[2].id,
  suspectProductName: products[2].name,
  hypothesis: "Observe whether visible measurements change.",
  baselineScanId: "baseline-id",
  analysisProfileVersion: "routine-sd-v1",
  primaryConcerns: ["redness"],
  result: seededResult,
  checkIns: []
};

describe("OpenAI routine recommendation provider", () => {
  it("accepts a sourced replacement and requests private structured web output", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        status: "completed",
        model: "gpt-5.6-sol",
        output: [
          {
            type: "web_search_call",
            action: {
              sources: [{
                title: "Candidate product",
                url: "https://brand.example.test/product"
              }]
            }
          },
          {
            type: "message",
            content: [{
              type: "output_text",
              text: JSON.stringify({
                action: "replace",
                existingProductId: products[2].id,
                candidateProduct: {
                  name: "Barrier moisturizer",
                  brand: "Example",
                  category: "Moisturizer",
                  productUrl: "https://brand.example.test/product",
                  estimatedPrice: "$14.99",
                  localAvailability: "Major US retailers",
                  affordabilityNote: "Below the configured $25 target at the cited retailer."
                },
                summary: "Test one replacement.",
                rationale: ["The experiment supports testing a different routine variable."],
                evidence: ["Moderate association."],
                measurementKeys: ["redness", "texture"],
                nutritionGuidance: {
                  focus: "Consistent meal pattern",
                  suggestion: "Track major diet changes without removing several foods.",
                  foodsToConsider: ["Fresh vegetables", "Beans", "Steel-cut oats"],
                  evidenceNote: "Diet evidence is mixed and does not establish causation.",
                  trackingPrompt: "Did your meal pattern change since the last scan?"
                },
                uncertainty: "The candidate still needs a controlled test."
              }),
              annotations: []
            }]
          }
        ]
      })
    );
    const provider = new OpenAiRoutineRecommendationProvider(
      "test-key",
      "gpt-5.6-sol",
      "https://api.openai.test/v1"
    );
    const result = await provider.generate({
      context: buildRecommendationContext(experiment, products),
      idempotencyKey: "stable-key",
      safetyIdentifier: "anonymous-user-hash"
    });
    expect(result).toMatchObject({
      action: "replace",
      existingProductId: products[2].id,
      candidateProduct: { name: "Barrier moisturizer" },
      measurementKeys: ["redness", "texture"],
      sources: [{ url: "https://brand.example.test/product" }]
    });
    const request = fetchSpy.mock.calls[0][1]!;
    const body = JSON.parse(String(request.body));
    expect(body.store).toBe(false);
    expect(body.tools).toEqual([{ type: "web_search", search_context_size: "low" }]);
    expect(body.tool_choice).toBe("required");
    expect(body.text.format.strict).toBe(true);
    expect(body.input[1].content).toContain("\"maxUnitPriceUsd\":25");
    expect(body.input[1].content).not.toContain("notes");
  });
});
