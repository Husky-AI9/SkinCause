import { MockSkinAnalysisProvider, YouCamSkinAnalysisProvider } from "@skincause/server-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSkinAnalysisProvider } from "../../apps/web/lib/skin-analysis";
import { POST as createUploadSession } from "../../apps/web/app/api/v1/scans/upload-sessions/route";
import { GET as getScan } from "../../apps/web/app/api/v1/scans/[id]/route";
import { POST as submitScan } from "../../apps/web/app/api/v1/scans/[id]/submit/route";
import { PUT as uploadScan } from "../../apps/web/app/api/v1/scans/[id]/upload/route";

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("scan route flow", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("selects the provider from YOUCAM_MOCK_MODE", () => {
    vi.stubEnv("YOUCAM_MOCK_MODE", "true");
    expect(createSkinAnalysisProvider()).toBeInstanceOf(MockSkinAnalysisProvider);

    vi.stubEnv("YOUCAM_MOCK_MODE", "false");
    vi.stubEnv("YOUCAM_API_KEY", "test-key");
    expect(createSkinAnalysisProvider()).toBeInstanceOf(YouCamSkinAnalysisProvider);
  });

  it("uploads, submits, and polls a mock scan through the route handlers", async () => {
    vi.stubEnv("YOUCAM_MOCK_MODE", "true");
    const clientRequestId = crypto.randomUUID();
    const sessionResponse = await createUploadSession(
      new Request("http://localhost/api/v1/scans/upload-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientRequestId,
          mimeType: "image/jpeg",
          byteSize: 3
        })
      })
    );
    expect(sessionResponse.status).toBe(201);
    const sessionPayload = await sessionResponse.json();
    const scanId = sessionPayload.data.scanId as string;

    const mismatchResponse = await uploadScan(
      new Request(`http://localhost/api/v1/scans/${scanId}/upload`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: new Uint8Array([1, 2])
      }),
      routeContext(scanId)
    );
    expect(mismatchResponse.status).toBe(400);

    const uploadResponse = await uploadScan(
      new Request(`http://localhost/api/v1/scans/${scanId}/upload`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: new Uint8Array([1, 2, 3])
      }),
      routeContext(scanId)
    );
    expect(uploadResponse.status).toBe(200);

    const submitRequest = () =>
      new Request(`http://localhost/api/v1/scans/${scanId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientRequestId })
      });
    const submitResponse = await submitScan(submitRequest(), routeContext(scanId));
    expect(submitResponse.status).toBe(202);

    const repeatedSubmitResponse = await submitScan(submitRequest(), routeContext(scanId));
    expect(repeatedSubmitResponse.status).toBe(202);

    const statusResponse = await getScan(
      new Request(`http://localhost/api/v1/scans/${scanId}`),
      routeContext(scanId)
    );
    expect(statusResponse.status).toBe(200);
    const statusPayload = await statusResponse.json();
    expect(statusPayload.data).toMatchObject({
      scanId,
      status: "normalized",
      result: {
        id: scanId,
        provider: "mock"
      }
    });
    expect(statusPayload.data.result.concerns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "ai_acne_severity",
          normalizedSeverity: expect.any(Number),
          experimentRole: "primary"
        }),
        expect.objectContaining({
          key: "ai_acne_pattern",
          displayLabel: expect.any(String),
          experimentRole: "context"
        })
      ])
    );
  });

  it("rejects unknown scan uploads", async () => {
    const response = await uploadScan(
      new Request("http://localhost/api/v1/scans/missing/upload", {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([1])
      }),
      routeContext("missing")
    );
    expect(response.status).toBe(404);
  });

  it("requires a durable authenticated session for production scan uploads", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await createUploadSession(
      new Request("https://skincause.example/api/v1/scans/upload-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientRequestId: crypto.randomUUID(),
          mimeType: "image/jpeg",
          byteSize: 3
        })
      })
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTH_REQUIRED", retryable: false }
    });
  });
});
