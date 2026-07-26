import { YouCamSkinAnalysisProvider } from "@skincause/server-core";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("YouCam provider integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the v2.1 file and task request schemas", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: {
            files: [
              {
                file_id: "file-1",
                requests: [{ method: "PUT", url: "https://uploads.example.test/file-1" }]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ data: { task_id: "task-1" } }));

    const provider = new YouCamSkinAnalysisProvider("test-api-key");
    const result = await provider.createAnalysis({
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
      requestedConcerns: ["redness", "texture"],
      idempotencyKey: "request-1"
    });

    expect(result.externalTaskId).toBe("task-1");
    expect(result.activity.map((event) => event.message)).toEqual([
      "POST /s2s/v2.1/file/skin-analysis -> 200; upload slot received",
      "PUT signed provider upload -> 200; 3 bytes accepted",
      "POST /s2s/v2.1/task/skin-analysis -> 200; analysis task accepted"
    ]);
    expect(JSON.stringify(result.activity)).not.toContain("task-1");
    expect(JSON.stringify(result.activity)).not.toContain("test-api-key");
    expect(JSON.stringify(result.activity)).not.toContain("uploads.example.test");

    const fileRequest = fetchMock.mock.calls[0];
    expect(fileRequest[0]).toBe("https://yce-api-01.makeupar.com/s2s/v2.1/file/skin-analysis");
    expect(JSON.parse(String(fileRequest[1]?.body))).toEqual({
      files: [
        {
          content_type: "image/jpeg",
          file_name: "scan.jpg",
          file_size: 3
        }
      ]
    });

    const taskRequest = fetchMock.mock.calls[2];
    expect(taskRequest[0]).toBe("https://yce-api-01.makeupar.com/s2s/v2.1/task/skin-analysis");
    expect(JSON.parse(String(taskRequest[1]?.body))).toEqual({
      src_file_id: "file-1",
      dst_actions: ["redness", "texture"],
      miniserver_args: {
        enable_mask_overlay: true
      },
      format: "json"
    });
  });

  it("normalizes successful v2.1 JSON results into concern severity", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        data: {
          task_status: "success",
          results: {
            output: [
              {
                type: "redness",
                raw_score: 76.5,
                ui_score: 80,
                mask_urls: ["https://results.example.test/redness.jpg"]
              },
              {
                type: "pore",
                raw_score: 62,
                ui_score: 65,
                mask_urls: ["javascript:alert(1)", "https://results.example.test/pores.jpg"]
              },
              { type: "all" },
              { type: "skin_age" },
              { type: "resize_image" }
            ]
          }
        }
      })
    );

    const provider = new YouCamSkinAnalysisProvider("test-api-key");
    const analysis = await provider.getAnalysis("task-1");

    expect(analysis.status).toBe("succeeded");
    if (analysis.status !== "succeeded") return;
    expect(analysis.result.provider).toBe("youcam");
    expect(analysis.result.providerVersion).toBe("v2.1");
    expect(analysis.activity.map((event) => event.message)).toEqual([
      "GET /s2s/v2.1/task/skin-analysis/:task_id -> 200",
      "provider status=success",
      "response normalized: pores=35 redness=20; masks=2"
    ]);
    expect(analysis.result.concerns).toEqual([
      {
        key: "redness",
        providerLabel: "Redness",
        rawScore: 76.5,
        normalizedSeverity: 20,
        directionSource: "provider-doc",
        maskUrl: "https://results.example.test/redness.jpg"
      },
      {
        key: "pores",
        providerLabel: "Pores",
        rawScore: 62,
        normalizedSeverity: 35,
        directionSource: "provider-doc",
        maskUrl: "https://results.example.test/pores.jpg"
      }
    ]);
  });

  it("keeps non-terminal v2.1 tasks in processing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ data: { task_status: "running" } })
    );

    const provider = new YouCamSkinAnalysisProvider("test-api-key");
    const result = await provider.getAnalysis("task-1");
    expect(result.status).toBe("processing");
    expect(result.activity.map((event) => event.message)).toEqual([
      "GET /s2s/v2.1/task/skin-analysis/:task_id -> 200",
      "provider status=running"
    ]);
  });
});
