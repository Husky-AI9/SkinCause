import { calculateAssociation, associationLabel } from "@skincause/association-engine";
import {
  calculateLongitudinalAssociation,
  calculateSkinSimulationParameters,
  classifyCosmeticConcern,
  compareScanConcerns,
  roundVisibleSeverity,
  summarizeScanReadiness,
  scans
} from "@skincause/domain";
import { describe, expect, it } from "vitest";

const components = {
  imageTrend: 80,
  selfReportTrend: 70,
  adherence: 100,
  repeatability: 90,
  confounderPenalty: 5,
  qualityPenalty: 2
};

describe("association engine", () => {
  it("maps the documented score bands", () => {
    expect(associationLabel(0)).toBe("low");
    expect(associationLabel(39)).toBe("low");
    expect(associationLabel(40)).toBe("moderate");
    expect(associationLabel(69)).toBe("moderate");
    expect(associationLabel(70)).toBe("strong");
    expect(associationLabel(100)).toBe("strong");
  });

  it("requires two follow-ups", () => {
    expect(calculateAssociation({ followUpCount: 1, knownDirection: true, components, usedConcerns: ["redness"] }).associationLevel).toBe("insufficient");
  });

  it("calculates a bounded deterministic score", () => {
    const result = calculateAssociation({ followUpCount: 3, knownDirection: true, components, usedConcerns: ["redness", "texture"] });
    expect(result.score).toBe(77);
    expect(result.associationLevel).toBe("strong");
  });

  it("never uses prohibited definitive result language", () => {
    const result = calculateAssociation({ followUpCount: 3, knownDirection: true, components, usedConcerns: ["redness"] });
    expect(result.wording.toLowerCase()).not.toMatch(/\b(diagnosed|allergic|cured|safe)\b/);
  });
});

describe("cosmetic concern severity", () => {
  it("formats visible measurement scores as bounded integers", () => {
    expect(roundVisibleSeverity(47.6)).toBe(48);
    expect(roundVisibleSeverity(102.4)).toBe(100);
    expect(roundVisibleSeverity(null)).toBeNull();
  });

  it("maps normalized concern scores to non-diagnostic display labels", () => {
    expect(classifyCosmeticConcern(32)).toEqual({ level: "mild", label: "Lower visible signal" });
    expect(classifyCosmeticConcern(44)).toEqual({ level: "moderate", label: "Middle visible signal" });
    expect(classifyCosmeticConcern(64)).toEqual({ level: "elevated", label: "Higher visible signal" });
    expect(classifyCosmeticConcern(null)).toEqual({ level: "unavailable", label: "Unavailable" });
  });
});

describe("scan evidence helpers", () => {
  it("explains capture readiness without presenting provider confidence", () => {
    expect(summarizeScanReadiness(scans[0])).toMatchObject({
      score: 100,
      label: "Strong capture"
    });
    expect(summarizeScanReadiness({
      ...scans[0],
      captureWarnings: ["Uneven lighting", "Face angle"],
      concerns: scans[0].concerns.map((concern, index) =>
        index === 0 ? { ...concern, normalizedSeverity: null } : concern
      )
    }).score).toBe(62);
  });

  it("keeps small score movement inside a visible comparison threshold", () => {
    const changes = compareScanConcerns(
      scans[0],
      scans.at(-1)!,
      ["blemish_pattern", "pores"]
    );
    expect(changes[0]).toMatchObject({ delta: -22, interpretation: "lower visible signal" });
    expect(changes[1]).toMatchObject({ delta: -3, interpretation: "within comparison threshold" });
  });
});

describe("longitudinal scan evidence", () => {
  it("compares a locked SD profile against the baseline with raw-derived severity", () => {
    const checkIns = scans.slice(1).map((scan, index) => ({
      id: `check-in-${index}`,
      experimentId: "experiment-id",
      scanId: scan.id,
      adherence: 100,
      observation: 7 - index * 2,
      confounders: index === 1 ? ["Unusual sun exposure"] : [],
      notes: null,
      occurredAt: scan.capturedAt
    }));
    const result = calculateLongitudinalAssociation({
      experimentType: "elimination",
      baseline: scans[0],
      followUps: scans.slice(1),
      checkIns,
      primaryConcerns: ["redness", "texture"]
    });
    expect(result.associationLevel).not.toBe("insufficient");
    expect(result.components.imageTrend).toBeGreaterThan(70);
    expect(result.usedConcerns).toEqual(["redness", "texture"]);
    expect(result.limitations.join(" ")).toContain("other changes");
  });
});

describe("skin simulation controls", () => {
  it("maps scan appearance scores into bounded YouCam parameters", () => {
    const parameters = calculateSkinSimulationParameters(scans[0], scans.at(-1)!);
    expect(parameters.redness).toBeCloseTo(0.25);
    expect(parameters.acne).toBeCloseTo(0.22);
    expect(parameters.texture).toBeCloseTo(0.11);
    expect(parameters.pores).toBeCloseTo(0.03);
    expect(parameters.radiance).toBeCloseTo(0.13);
    expect(parameters.oiliness).toBe(0);
    expect(parameters.darkCircle).toBe(0);
    expect(Object.values(parameters).every((value) => value >= 0 && value <= 1)).toBe(true);
  });
});
