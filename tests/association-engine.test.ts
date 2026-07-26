import { calculateAssociation, associationLabel } from "@skincause/association-engine";
import { classifyCosmeticConcern } from "@skincause/domain";
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
  it("maps normalized concern scores to non-diagnostic display labels", () => {
    expect(classifyCosmeticConcern(32)).toEqual({ level: "mild", label: "Mild concern" });
    expect(classifyCosmeticConcern(44)).toEqual({ level: "moderate", label: "Moderate concern" });
    expect(classifyCosmeticConcern(64)).toEqual({ level: "elevated", label: "Elevated concern" });
    expect(classifyCosmeticConcern(null)).toEqual({ level: "unavailable", label: "Unavailable" });
  });
});
