import { calculateAssociation } from "@skincause/association-engine";
import type { Product, Scan } from "@skincause/contracts";

export const persistentDisclaimer =
  "SkinCause provides cosmetic tracking and organizational insights, not medical diagnosis or treatment. Results may be affected by lighting, camera quality, routine adherence, time, and other changes.";

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

export const scans: Scan[] = [
  {
    id: "scan-baseline",
    status: "normalized",
    capturedAt: "2026-06-08T09:15:00.000Z",
    provider: "mock",
    captureWarnings: [],
    concerns: [
      { key: "redness", providerLabel: "Redness", rawScore: 68, normalizedSeverity: 68, directionSource: "configured" },
      { key: "texture", providerLabel: "Texture", rawScore: 55, normalizedSeverity: 55, directionSource: "configured" },
      { key: "pores", providerLabel: "Pores", rawScore: 42, normalizedSeverity: 42, directionSource: "configured" }
    ]
  },
  {
    id: "scan-followup-1",
    status: "normalized",
    capturedAt: "2026-06-13T09:10:00.000Z",
    provider: "mock",
    captureWarnings: [],
    concerns: [
      { key: "redness", providerLabel: "Redness", rawScore: 58, normalizedSeverity: 58, directionSource: "configured" },
      { key: "texture", providerLabel: "Texture", rawScore: 51, normalizedSeverity: 51, directionSource: "configured" },
      { key: "pores", providerLabel: "Pores", rawScore: 41, normalizedSeverity: 41, directionSource: "configured" }
    ]
  },
  {
    id: "scan-followup-2",
    status: "normalized",
    capturedAt: "2026-06-18T09:20:00.000Z",
    provider: "mock",
    captureWarnings: ["Lighting was slightly warmer than the baseline."],
    concerns: [
      { key: "redness", providerLabel: "Redness", rawScore: 47, normalizedSeverity: 47, directionSource: "configured" },
      { key: "texture", providerLabel: "Texture", rawScore: 46, normalizedSeverity: 46, directionSource: "configured" },
      { key: "pores", providerLabel: "Pores", rawScore: 40, normalizedSeverity: 40, directionSource: "configured" }
    ]
  },
  {
    id: "scan-followup-3",
    status: "normalized",
    capturedAt: "2026-06-23T09:12:00.000Z",
    provider: "mock",
    captureWarnings: [],
    concerns: [
      { key: "redness", providerLabel: "Redness", rawScore: 43, normalizedSeverity: 43, directionSource: "configured" },
      { key: "texture", providerLabel: "Texture", rawScore: 44, normalizedSeverity: 44, directionSource: "configured" },
      { key: "pores", providerLabel: "Pores", rawScore: 39, normalizedSeverity: 39, directionSource: "configured" }
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
  usedConcerns: ["redness", "texture"],
  limitations: [
    "One check-in included unusual sun exposure.",
    "Camera and lighting differences can affect measured skin scores."
  ]
});

export const seededExperiment = {
  id: "brightening-serum-elimination",
  name: "Brightening serum elimination",
  type: "elimination" as const,
  status: "completed" as const,
  startedAt: "2026-06-09T08:00:00.000Z",
  endedAt: "2026-06-24T08:00:00.000Z",
  suspectProductId: "brightening-serum",
  hypothesis: "Observe whether redness and texture change while the serum is paused.",
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
