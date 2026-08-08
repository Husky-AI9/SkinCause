import {
  OpenAiAcnePatternAssessmentProvider,
  appendAcnePatternAssessment
} from "@skincause/server-core";
import { scans } from "@skincause/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAI visible acne-pattern assessment", () => {
  it("uses structured YouCam measurements without sending an image", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        status: "completed",
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({
              severityScore: 64,
              visiblePattern: "Redness-dominant acne pattern",
              basis: "Visible blemish and redness measurements were strongest; capture conditions can affect the result."
            })
          }]
        }]
      })
    );
    const provider = new OpenAiAcnePatternAssessmentProvider(
      "test-key",
      "gpt-5.6-sol",
      "https://api.openai.test/v1"
    );
    const assessment = await provider.assess({
      concerns: scans[0].concerns,
      idempotencyKey: "stable-acne-assessment"
    });
    const enriched = appendAcnePatternAssessment(scans[0], assessment);

    expect(enriched.concerns).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "ai_acne_severity", normalizedSeverity: 64 }),
      expect.objectContaining({
        key: "ai_acne_pattern",
        displayLabel: "Redness-dominant acne pattern"
      })
    ]));
    const request = fetchSpy.mock.calls[0][1]!;
    const body = JSON.parse(String(request.body));
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(body.input[1].content).toContain("normalizedVisibleSeverity");
    expect(body.input[1].content).not.toContain("image");
    expect(body.input[1].content).not.toContain("maskUrl");
  });
});
