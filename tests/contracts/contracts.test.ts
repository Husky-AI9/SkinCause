import {
  apiSuccessSchema,
  createCheckInSchema,
  createExperimentSchema,
  productSchema,
  scanActivityEventSchema,
  scanSchema,
  scanUploadSessionSchema
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
      hypothesis: "Observe whether the cosmetic concern changes during the experiment."
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
      captureWarnings: [],
      concerns: [{
        key: "redness",
        providerLabel: "Redness",
        rawScore: 76.5,
        normalizedSeverity: 24,
        directionSource: "provider-doc",
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
});
