import { YouCamSkinSimulationProvider } from "@skincause/server-core";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

const parameters = {
  acne: 1,
  darkCircle: 0.5,
  eyeBags: 0.7,
  oiliness: 0.7,
  pores: 0.5,
  radiance: 0.7,
  redness: 0.7,
  spots: 0.7,
  texture: 0.7,
  wrinkle: 0.7
};

describe("YouCam skin simulation provider", () => {
  it("uploads image bytes through the File API and starts from the returned file id", async () => {
    const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({
        data: {
          files: [{
            file_id: "simulation-file",
            requests: [{
              method: "PUT",
              url: "https://uploads.example.test/simulation-file",
              headers: { "x-upload-token": "signed-token" }
            }]
          }]
        }
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ data: { task_id: "simulation-task" } }));
    const provider = new YouCamSkinSimulationProvider(
      "test-key",
      "https://yce-api.test/s2s/v2.0/task/skin-simulation"
    );

    await expect(provider.uploadSourceImage({
      image,
      mimeType: "image/png",
      fileName: "skincause-demo-face.png",
      idempotencyKey: "simulation-file-key"
    })).resolves.toEqual({ sourceFileId: "simulation-file" });
    await expect(provider.start({
      sourceFileId: "simulation-file",
      parameters,
      idempotencyKey: "simulation-task-key"
    })).resolves.toEqual({ externalTaskId: "simulation-task" });

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://yce-api.test/s2s/v2.0/file/skin-simulation"
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      files: [{
        content_type: "image/png",
        file_name: "skincause-demo-face.png",
        file_size: image.byteLength
      }]
    });
    expect(fetchSpy.mock.calls[1][0]).toBe(
      "https://uploads.example.test/simulation-file"
    );
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      headers: { "x-upload-token": "signed-token" }
    });
    const startBody = JSON.parse(String(fetchSpy.mock.calls[2][1]?.body));
    expect(startBody).toMatchObject({ src_file_id: "simulation-file" });
    expect(startBody).not.toHaveProperty("src_file_url");
  });

  it("starts a v2.0 task with mapped controls and normalizes the result URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ data: { task_id: "simulation-task" } }))
      .mockResolvedValueOnce(Response.json({
        status: 200,
        data: {
          error: null,
          results: {
            url: "https://yce-us.s3-accelerate.amazonaws.com/ttl30/result.png"
          },
          task_status: "success"
        }
      }));
    const provider = new YouCamSkinSimulationProvider(
      "test-key",
      "https://yce-api.test/s2s/v2.0/task/skin-simulation"
    );
    await expect(provider.start({
      sourceImageUrl: "https://storage.example.test/baseline.png",
      parameters,
      idempotencyKey: "simulation-key"
    })).resolves.toEqual({ externalTaskId: "simulation-task" });
    await expect(provider.get("simulation-task")).resolves.toEqual({
      status: "succeeded",
      resultUrl: "https://yce-us.s3-accelerate.amazonaws.com/ttl30/result.png"
    });
    const startBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(startBody).toEqual({
      src_file_url: "https://storage.example.test/baseline.png",
      acne: 1,
      dark_circle: 0.5,
      eye_bags: 0.7,
      oiliness: 0.7,
      pores: 0.5,
      radiance: 0.7,
      redness: 0.7,
      spots: 0.7,
      texture: 0.7,
      wrinkle: 0.7
    });
    expect(fetchSpy.mock.calls[1][0]).toBe(
      "https://yce-api.test/s2s/v2.0/task/skin-simulation/simulation-task"
    );
  });

  it("keeps nullable non-terminal responses in progress", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({
      data: {
        error: null,
        error_code: null,
        results: null,
        task_status: "processing"
      }
    }));
    const provider = new YouCamSkinSimulationProvider(
      "test-key",
      "https://yce-api.test/s2s/v2.0/task/skin-simulation"
    );
    await expect(provider.get("simulation-task")).resolves.toEqual({
      status: "processing"
    });
  });
});
