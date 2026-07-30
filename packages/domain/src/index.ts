import { calculateAssociation } from "@skincause/association-engine";
import type {
  AssociationResult,
  CheckIn,
  Concern,
  Product,
  Scan,
  SkinSimulationParameters
} from "@skincause/contracts";

export const persistentDisclaimer =
  "SkinCause provides cosmetic tracking and organizational insights, not medical diagnosis or treatment. Results may be affected by lighting, camera quality, routine adherence, time, and other changes.";

export const routineRecommendationDisclaimer =
  "AI guidance organizes acne-related cosmetic measurements, experiment evidence, current product information, and conservative nutrition context. It is not medical advice, does not establish product safety or suitability, and never changes your routine automatically. Verify current price and local availability.";

export const skinSimulationDisclaimer =
  "This is an AI-generated illustration based on selected cosmetic measurement changes, not a prediction, diagnosis, treatment result, or guarantee that a product will change your skin.";

export const defaultAcneGuidancePreferences = {
  market: "United States",
  maxUnitPriceUsd: 25,
  priorities: [
    "widely available at a pharmacy, mass retailer, or major online retailer",
    "price at or below the target when a current source can verify it",
    "non-comedogenic or oil-free labeling only when a source verifies the claim"
  ]
} as const;

export const acneNutritionGuardrails = [
  "Offer one optional observation or balanced-food habit, not a restrictive diet.",
  "Do not recommend supplements, fasting, or removing a food group.",
  "Describe diet evidence as possible and mixed, not causal.",
  "Do not imply that nutrition replaces acne care from a qualified professional."
] as const;

export type CosmeticConcernLevel = "mild" | "moderate" | "elevated" | "unavailable";

export function classifyCosmeticConcern(
  normalizedSeverity: number | null
): { level: CosmeticConcernLevel; label: string } {
  if (normalizedSeverity === null) {
    return { level: "unavailable", label: "Unavailable" };
  }
  if (normalizedSeverity <= 33) {
    return { level: "mild", label: "Lower visible signal" };
  }
  if (normalizedSeverity <= 59) {
    return { level: "moderate", label: "Middle visible signal" };
  }
  return { level: "elevated", label: "Higher visible signal" };
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const clampRatio = (value: number) =>
  Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));

export function calculateSkinSimulationParameters(
  baseline: Scan,
  followUp: Scan
): SkinSimulationParameters {
  const baselineSeverity = new Map(
    baseline.concerns.map((concern) => [concern.key, concern.normalizedSeverity])
  );
  const followUpSeverity = new Map(
    followUp.concerns.map((concern) => [concern.key, concern.normalizedSeverity])
  );
  const improvement = (key: string) => {
    const before = baselineSeverity.get(key);
    const after = followUpSeverity.get(key);
    if (before === null || before === undefined || after === null || after === undefined) return 0;
    return clampRatio(Math.max(0, before - after) / 100);
  };
  return {
    acne: improvement("blemish_pattern"),
    darkCircle: 0,
    eyeBags: 0,
    // YouCam defines this control as adding oil/shine, so it is intentionally disabled.
    oiliness: 0,
    pores: improvement("pores"),
    radiance: improvement("radiance"),
    redness: improvement("redness"),
    spots: 0,
    texture: improvement("texture"),
    wrinkle: 0
  };
}

export function calculateLongitudinalAssociation(input: {
  experimentType: "elimination" | "reintroduction";
  baseline: Scan;
  followUps: Scan[];
  checkIns: CheckIn[];
  primaryConcerns: string[];
}): AssociationResult {
  const baselineByKey = new Map(
    input.baseline.concerns.map((concern) => [concern.key, concern.normalizedSeverity])
  );
  const comparableFollowUps = input.followUps.flatMap((scan) => {
    if (scan.analysisProfileVersion !== input.baseline.analysisProfileVersion) return [];
    const severities = new Map(scan.concerns.map((concern) => [concern.key, concern.normalizedSeverity]));
    const deltas = input.primaryConcerns.flatMap((key) => {
      const baseline = baselineByKey.get(key);
      const current = severities.get(key);
      if (baseline === null || baseline === undefined || current === null || current === undefined) return [];
      return [input.experimentType === "elimination" ? baseline - current : current - baseline];
    });
    if (deltas.length !== input.primaryConcerns.length) return [];
    return [{
      expectedDelta: deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
      warningCount: scan.captureWarnings.length
    }];
  });

  const consistentCount = comparableFollowUps.filter((scan) => scan.expectedDelta > 0).length;
  const consistency = comparableFollowUps.length === 0
    ? 0
    : (consistentCount / comparableFollowUps.length) * 100;
  const averageExpectedDelta = comparableFollowUps.length === 0
    ? 0
    : comparableFollowUps.reduce((sum, scan) => sum + scan.expectedDelta, 0) /
      comparableFollowUps.length;
  const imageTrend = clampPercent(0.65 * consistency + 0.35 * clampPercent(averageExpectedDelta * 5));

  const observations = input.checkIns.map((checkIn) => checkIn.observation);
  const observationDirection = observations.length < 2
    ? 0
    : input.experimentType === "elimination"
      ? observations[0] - observations.at(-1)!
      : observations.at(-1)! - observations[0];
  const observationSteps = observations.slice(1).map((value, index) =>
    input.experimentType === "elimination"
      ? observations[index] - value
      : value - observations[index]
  );
  const observationConsistency = observationSteps.length === 0
    ? 0
    : (observationSteps.filter((value) => value >= 0).length / observationSteps.length) * 100;
  const selfReportTrend = clampPercent(
    0.6 * observationConsistency + 0.4 * clampPercent(observationDirection * 20)
  );
  const adherence = input.checkIns.length === 0
    ? 0
    : clampPercent(
        input.checkIns.reduce((sum, checkIn) => sum + checkIn.adherence, 0) / input.checkIns.length
      );
  const scansWithWarnings = comparableFollowUps.filter((scan) => scan.warningCount > 0).length;
  const missingScanCount = Math.max(0, input.checkIns.length - input.followUps.length);
  const repeatability = comparableFollowUps.length === 0
    ? 0
    : clampPercent(
        100 -
        (scansWithWarnings / comparableFollowUps.length) * 20 -
        (missingScanCount / Math.max(1, input.checkIns.length)) * 35
      );
  const confoundedCheckIns = input.checkIns.filter((checkIn) => checkIn.confounders.length > 0);
  const confounderPenalty = Math.min(50, confoundedCheckIns.length * 8);
  const qualityPenalty = Math.min(
    40,
    scansWithWarnings * 5 + missingScanCount * 8 +
      Math.max(0, input.followUps.length - comparableFollowUps.length) * 10
  );
  const limitations = [
    ...(confoundedCheckIns.length > 0
      ? [`${confoundedCheckIns.length} check-in${confoundedCheckIns.length === 1 ? "" : "s"} included other changes.`]
      : []),
    ...(missingScanCount > 0
      ? [`${missingScanCount} check-in${missingScanCount === 1 ? "" : "s"} did not include a comparable scan.`]
      : []),
    ...(comparableFollowUps.length < 2
      ? ["At least two comparable follow-up scans are needed."]
      : []),
    "Lighting, framing, and camera differences can affect visible measurements."
  ];

  return calculateAssociation({
    followUpCount: comparableFollowUps.length,
    knownDirection: input.primaryConcerns.every((key) => {
      const baselineValue = baselineByKey.get(key);
      return baselineValue !== null && baselineValue !== undefined;
    }),
    components: {
      imageTrend,
      selfReportTrend,
      adherence,
      repeatability,
      confounderPenalty,
      qualityPenalty
    },
    usedConcerns: input.primaryConcerns,
    limitations
  });
}

export const products: Product[] = [
  {
    id: "gentle-cleanser",
    name: "Gentle Cleanser",
    brand: "Morrow",
    category: "Cleanser",
    startedAt: "2026-02-12T08:00:00.000Z",
    cadence: "daily",
    timeOfDay: "AM + PM",
    active: true,
    recentlyChanged: false
  },
  {
    id: "barrier-moisturizer",
    name: "Barrier Moisturizer",
    brand: "Fieldwork",
    category: "Moisturizer",
    startedAt: "2026-03-04T08:00:00.000Z",
    cadence: "daily",
    timeOfDay: "AM + PM",
    active: true,
    recentlyChanged: false
  },
  {
    id: "brightening-serum",
    name: "Brightening Serum",
    brand: "Northstar",
    category: "Serum",
    startedAt: "2026-06-01T08:00:00.000Z",
    cadence: "daily",
    timeOfDay: "PM",
    active: false,
    recentlyChanged: true
  }
];

const mockConcernDefinitions = {
  redness: ["Redness", "Visible redness pattern", "primary"],
  blemish_pattern: ["Acne", "Visible blemish pattern", "primary"],
  texture: ["Texture", "Texture variation", "primary"],
  pores: ["Pore", "Pore visibility", "primary"],
  oiliness: ["Oiliness", "Visible oiliness", "supporting"],
  hydration: ["Moisture", "Visible hydration signal", "supporting"],
  radiance: ["Radiance", "Radiance", "supporting"]
} as const;

function mockConcern(key: keyof typeof mockConcernDefinitions, severity: number): Concern {
  const [providerLabel, displayLabel, experimentRole] = mockConcernDefinitions[key];
  const rawScore = 100 - severity;
  return {
    key,
    providerLabel,
    displayLabel,
    rawScore,
    uiScore: Math.min(100, rawScore + 4),
    normalizedSeverity: severity,
    directionSource: "provider-doc",
    experimentRole
  };
}

export const scans: Scan[] = [
  {
    id: "scan-baseline",
    status: "normalized",
    capturedAt: "2026-06-08T09:15:00.000Z",
    provider: "mock",
    providerVersion: "fixture-v1",
    analysisProfileVersion: "routine-sd-v1",
    captureWarnings: [],
    concerns: [
      mockConcern("redness", 68),
      mockConcern("blemish_pattern", 60),
      mockConcern("texture", 55),
      mockConcern("pores", 42),
      mockConcern("oiliness", 45),
      mockConcern("hydration", 50),
      mockConcern("radiance", 48)
    ]
  },
  {
    id: "scan-followup-1",
    status: "normalized",
    capturedAt: "2026-06-13T09:10:00.000Z",
    provider: "mock",
    providerVersion: "fixture-v1",
    analysisProfileVersion: "routine-sd-v1",
    captureWarnings: [],
    concerns: [
      mockConcern("redness", 58),
      mockConcern("blemish_pattern", 52),
      mockConcern("texture", 51),
      mockConcern("pores", 41),
      mockConcern("oiliness", 42),
      mockConcern("hydration", 45),
      mockConcern("radiance", 44)
    ]
  },
  {
    id: "scan-followup-2",
    status: "normalized",
    capturedAt: "2026-06-18T09:20:00.000Z",
    provider: "mock",
    providerVersion: "fixture-v1",
    analysisProfileVersion: "routine-sd-v1",
    captureWarnings: ["Lighting was slightly warmer than the baseline."],
    concerns: [
      mockConcern("redness", 47),
      mockConcern("blemish_pattern", 43),
      mockConcern("texture", 46),
      mockConcern("pores", 40),
      mockConcern("oiliness", 40),
      mockConcern("hydration", 40),
      mockConcern("radiance", 40)
    ]
  },
  {
    id: "scan-followup-3",
    status: "normalized",
    capturedAt: "2026-06-23T09:12:00.000Z",
    provider: "mock",
    providerVersion: "fixture-v1",
    analysisProfileVersion: "routine-sd-v1",
    captureWarnings: [],
    concerns: [
      mockConcern("redness", 43),
      mockConcern("blemish_pattern", 38),
      mockConcern("texture", 44),
      mockConcern("pores", 39),
      mockConcern("oiliness", 38),
      mockConcern("hydration", 36),
      mockConcern("radiance", 35)
    ]
  }
];

export const seededResult = calculateAssociation({
  followUpCount: 3,
  knownDirection: true,
  components: {
    imageTrend: 86,
    selfReportTrend: 78,
    adherence: 100,
    repeatability: 94,
    confounderPenalty: 8,
    qualityPenalty: 2
  },
  usedConcerns: ["blemish_pattern", "redness", "texture"],
  limitations: [
    "One check-in included unusual sun exposure.",
    "Camera and lighting differences can affect measured skin scores."
  ]
});

export const insufficientResult = calculateAssociation({
  followUpCount: 0,
  knownDirection: false,
  components: {
    imageTrend: 0,
    selfReportTrend: 0,
    adherence: 0,
    repeatability: 0,
    confounderPenalty: 0,
    qualityPenalty: 0
  },
  usedConcerns: [],
  limitations: [
    "A baseline and at least two comparable follow-up scans are needed.",
    "Lighting, framing, and camera differences can affect visible measurements."
  ]
});

export const seededExperiment = {
  id: "brightening-serum-elimination",
  name: "Acne-pattern routine experiment",
  type: "elimination" as const,
  status: "completed" as const,
  startedAt: "2026-06-09T08:00:00.000Z",
  endedAt: "2026-06-24T08:00:00.000Z",
  suspectProductId: "brightening-serum",
  hypothesis: "Observe whether visible acne, redness, and texture signals change while the serum is paused.",
  checkIns: [
    { id: "checkin-1", date: "Jun 13", day: 4, adherence: 100, observation: 7, confounder: null, scanId: "scan-followup-1" },
    { id: "checkin-2", date: "Jun 18", day: 9, adherence: 100, observation: 5, confounder: "Unusual sun exposure", scanId: "scan-followup-2" },
    { id: "checkin-3", date: "Jun 23", day: 14, adherence: 100, observation: 4, confounder: null, scanId: "scan-followup-3" }
  ],
  result: seededResult
};

export const errorMessages: Record<string, string> = {
  IMAGE_TOO_SMALL: "Choose a larger image or retake closer to the camera.",
  FACE_TOO_SMALL: "Center the face and move closer so it fills the guide.",
  IMAGE_TOO_DARK: "Move to even front lighting and retake.",
  FACE_OUT_OF_FRAME: "Keep the full face inside the guide.",
  UNSUPPORTED_FORMAT: "Upload a JPG or PNG image.",
  PROVIDER_TIMEOUT: "The scan is preserved. Retry status when you are ready."
};

export function assertSingleRoutineChange(changedProductIds: string[]) {
  if (changedProductIds.length !== 1) {
    throw new Error("An active investigation must change exactly one product.");
  }
}
