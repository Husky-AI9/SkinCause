import {
  apiSuccessSchema,
  createCheckInSchema,
  createExperimentSchema,
  productSchema,
  routineRecommendationRequestSchema,
  routineRecommendationSchema,
  scanActivityEventSchema,
  scanSchema,
  scanUploadSessionSchema,
  skinSimulationSchema
} from "@skincause/contracts";
import { products } from "@skincause/domain";
import { describe, expect, it } from "vitest";

describe("portable API contracts", () => {
  it("validates the seeded product contract", () => {
    expect(productSchema.array().parse(products)).toHaveLength(3);
  });

  it("validates the standard response envelope", () => {
    const schema = apiSuccessSchema(productSchema.array());
    expect(schema.parse({ data: products, meta: { requestId: "req_1", apiVersion: "v1" } }).data).toHaveLength(3);
  });

  it("validates experiment and check-in mutation payloads", () => {
    expect(createExperimentSchema.safeParse({
      type: "elimination",
      suspectProductId: "product-id",
      startedAt: "2026-07-24T08:00:00.000Z",
      hypothesis: "Observe whether the cosmetic concern changes during the experiment.",
      baselineScanId: "baseline-scan-id",
      analysisProfileVersion: "routine-sd-v1",
      primaryConcerns: ["redness", "texture"]
    }).success).toBe(true);
    expect(createCheckInSchema.safeParse({
      adherence: 100,
      observation: 4,
      confounders: ["Unusual sun exposure"]
    }).success).toBe(true);
    expect(createCheckInSchema.safeParse({
      adherence: 120,
      observation: 11
    }).success).toBe(false);
  });

  it("validates the configurable recommendation budget", () => {
    expect(routineRecommendationRequestSchema.safeParse({ maxUnitPriceUsd: 40 }).success).toBe(true);
    expect(routineRecommendationRequestSchema.safeParse({ maxUnitPriceUsd: 0 }).success).toBe(false);
    expect(routineRecommendationRequestSchema.safeParse({ maxUnitPriceUsd: 501 }).success).toBe(false);
  });

  it("validates signed and same-origin scan upload targets", () => {
    expect(scanUploadSessionSchema.safeParse({
      scanId: "scan-id",
      upload: {
        type: "supabase-signed",
        bucket: "scan-images",
        path: "owner/scan/3.jpg",
        token: "signed-token"
      },
      expiresAt: "2026-07-25T18:00:00.000Z"
    }).success).toBe(true);
    expect(scanUploadSessionSchema.safeParse({
      scanId: "scan-id",
      upload: {
        type: "same-origin",
        url: "/api/v1/scans/scan-id/upload",
        method: "PUT",
        requiredHeaders: { "content-type": "image/jpeg" }
      },
      expiresAt: "2026-07-25T18:00:00.000Z"
    }).success).toBe(true);
  });

  it("validates sanitized scan activity events as portable contract data", () => {
    expect(scanActivityEventSchema.safeParse({
      id: "event-id",
      at: "2026-07-25T18:00:00.000Z",
      source: "youcam",
      level: "success",
      message: "provider status=success"
    }).success).toBe(true);
    expect(scanActivityEventSchema.safeParse({
      id: "event-id",
      at: "not-a-date",
      source: "vendor",
      level: "success",
      message: ""
    }).success).toBe(false);
  });

  it("accepts secure short-lived concern masks and rejects unsafe mask URLs", () => {
    const scan = {
      id: "scan-id",
      status: "normalized",
      capturedAt: "2026-07-25T18:00:00.000Z",
      provider: "youcam",
      providerVersion: "v2.1",
      analysisProfileVersion: "routine-sd-v1",
      captureWarnings: [],
      concerns: [{
        key: "redness",
        providerLabel: "Redness",
        displayLabel: "Visible redness pattern",
        rawScore: 76.5,
        uiScore: 80,
        normalizedSeverity: 23.5,
        directionSource: "provider-doc",
        experimentRole: "primary",
        maskUrl: "https://results.example.test/redness.jpg"
      }]
    };
    expect(scanSchema.safeParse(scan).success).toBe(true);
    expect(scanSchema.safeParse({
      ...scan,
      concerns: [{ ...scan.concerns[0], maskUrl: "not-a-url" }]
    }).success).toBe(false);
    expect(scanSchema.safeParse({
      ...scan,
      concerns: [{ ...scan.concerns[0], maskUrl: "javascript:alert(1)" }]
    }).success).toBe(false);
  });

  it("validates sourced product replacements and private simulation status", () => {
    expect(routineRecommendationSchema.safeParse({
      experimentId: "experiment-id",
      model: "gpt-5.6-sol",
      generatedAt: "2026-07-27T20:00:00.000Z",
      action: "replace",
      existingProductId: "product-id",
      existingProductName: "Current serum",
      candidateProduct: {
        name: "Candidate moisturizer",
        brand: "Example brand",
        category: "Moisturizer",
        productUrl: "https://example.test/product",
        imageUrl: "https://example.test/product.jpg",
        estimatedPrice: "$12.99",
        packageSize: "3 fl oz",
        pricePerUnit: "$4.33 per fl oz",
        priceCheckedAt: "2026-08-07T12:00:00.000Z",
        localAvailability: "Major US retailers",
        affordabilityNote: "Below the configured demo budget.",
        keyIngredients: ["Ceramides", "Squalane"],
        usageNote: "Introduce as the only routine change and follow the label.",
        lowerCostAlternative: "Keep the current moisturizer."
      },
      summary: "Test one replacement while keeping the rest of the routine stable.",
      rationale: ["The experiment showed a repeated visible pattern."],
      evidence: ["Moderate deterministic association."],
      measurementKeys: ["redness", "texture"],
      sources: [{ title: "Product page", url: "https://example.test/product" }],
      nutritionGuidance: {
        focus: "Meal consistency",
        suggestion: "Track major diet changes.",
        foodsToConsider: ["Fresh vegetables", "Beans", "Steel-cut oats"],
        evidenceNote: "Evidence is mixed.",
        trackingPrompt: "Did your meal pattern change?"
      },
      uncertainty: "This is a hypothesis to test, not proof of suitability.",
      disclaimer: "Not medical advice."
    }).success).toBe(true);
    expect(skinSimulationSchema.safeParse({
      experimentId: "experiment-id",
      status: "processing",
      provider: "youcam",
      sourceScanId: "baseline-id",
      targetScanId: "follow-up-id",
      expiresAt: null,
      generatedAt: null,
      pollAfterMs: 2000,
      disclaimer: "Illustrative only."
    }).success).toBe(true);
  });
});
