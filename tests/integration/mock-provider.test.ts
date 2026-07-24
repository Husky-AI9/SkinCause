import { MockSkinAnalysisProvider, serverServices } from "@skincause/server-core";
import { describe, expect, it } from "vitest";

describe("mock provider integration", () => {
  it("normalizes a deterministic success result", async () => {
    const provider = new MockSkinAnalysisProvider();
    const created = await provider.createAnalysis({
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
      requestedConcerns: ["redness"],
      idempotencyKey: "stable-key"
    });
    const result = await provider.getAnalysis(created.externalTaskId);
    expect(result.status).toBe("succeeded");
  });

  it("reuses upload sessions for the same client request", () => {
    const first = serverServices.createUploadSession("request-1");
    const second = serverServices.createUploadSession("request-1");
    expect(first.scanId).toBe(second.scanId);
  });
});
