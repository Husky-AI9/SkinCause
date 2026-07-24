import type { AssociationComponents, AssociationResult } from "@skincause/contracts";

export type EvidenceInput = {
  followUpCount: number;
  knownDirection: boolean;
  components: AssociationComponents;
  usedConcerns: string[];
  limitations?: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function associationLabel(score: number): "low" | "moderate" | "strong" {
  if (score >= 70) return "strong";
  if (score >= 40) return "moderate";
  return "low";
}

export function calculateAssociation(input: EvidenceInput): AssociationResult {
  const { components } = input;
  const insufficient =
    input.followUpCount < 2 ||
    !input.knownDirection ||
    components.confounderPenalty >= 45;

  if (insufficient) {
    return {
      associationLevel: "insufficient",
      score: null,
      components,
      usedConcerns: input.usedConcerns,
      limitations: input.limitations ?? ["More clean, repeated check-ins are needed."],
      wording: "There is not enough clean, repeated evidence to interpret this experiment."
    };
  }

  const score = clamp(
    0.35 * components.imageTrend +
      0.25 * components.selfReportTrend +
      0.2 * components.adherence +
      0.2 * components.repeatability -
      components.confounderPenalty -
      components.qualityPenalty
  );
  const associationLevel = associationLabel(score);
  const wording = {
    low: "The observed changes do not consistently track the product change.",
    moderate: "Some observed changes track the product change, but uncertainty or confounders remain.",
    strong:
      "Repeated observations consistently track the product change under this experiment. This is still not proof of causation."
  }[associationLevel];

  return {
    associationLevel,
    score,
    components,
    usedConcerns: input.usedConcerns,
    limitations: input.limitations ?? [],
    wording
  };
}
