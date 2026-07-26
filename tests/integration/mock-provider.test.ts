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
    expect(created.activity[0]?.source).toBe("mock");
    expect(result.activity.at(-1)?.message).toContain("test output normalized");
  });

  it("reuses upload sessions for the same client request", () => {
    const first = serverServices.createUploadSession("request-1");
    const second = serverServices.createUploadSession("request-1");
    expect(first.scanId).toBe(second.scanId);
  });

  it("returns safe retryable errors when provider submission fails", async () => {
    const clientRequestId = crypto.randomUUID();
    const session = serverServices.createUploadSession(clientRequestId, {
      mimeType: "image/jpeg",
      byteSize: 3
    });
    serverServices.storeScanImage(session.scanId, new Uint8Array([1, 2, 3]), "image/jpeg");

    const result = await serverServices.submitScan(session.scanId, {
      createAnalysis: async () => {
        throw new Error("sensitive vendor response");
      },
      getAnalysis: async () => ({ status: "processing" as const, activity: [] })
    });

    expect(result?.error).toEqual({
      code: "PROVIDER_NETWORK_ERROR",
      message: "Analysis is temporarily unavailable.",
      retryable: true
    });

    const retried = await serverServices.submitScan(session.scanId, new MockSkinAnalysisProvider());
    expect(retried?.status).toBe("processing");
  });
});
