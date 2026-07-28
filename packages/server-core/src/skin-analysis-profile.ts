import { z } from "zod";

export const ROUTINE_SD_PROFILE_VERSION = "routine-sd-v1";

export const ROUTINE_SD_ACTIONS = [
  "redness",
  "acne",
  "texture",
  "pore",
  "oiliness",
  "moisture",
  "radiance"
] as const;

export type RoutineSdAction = (typeof ROUTINE_SD_ACTIONS)[number];

export const routineSdActionSchema = z.enum(ROUTINE_SD_ACTIONS);

export type ConcernDefinition = {
  providerAction: RoutineSdAction;
  key: string;
  providerLabel: string;
  displayLabel: string;
  experimentRole: "primary" | "supporting";
};

export const ROUTINE_SD_CONCERNS: readonly ConcernDefinition[] = [
  {
    providerAction: "redness",
    key: "redness",
    providerLabel: "Redness",
    displayLabel: "Visible redness pattern",
    experimentRole: "primary"
  },
  {
    providerAction: "acne",
    key: "blemish_pattern",
    providerLabel: "Acne",
    displayLabel: "Visible blemish pattern",
    experimentRole: "primary"
  },
  {
    providerAction: "texture",
    key: "texture",
    providerLabel: "Texture",
    displayLabel: "Texture variation",
    experimentRole: "primary"
  },
  {
    providerAction: "pore",
    key: "pores",
    providerLabel: "Pore",
    displayLabel: "Pore visibility",
    experimentRole: "primary"
  },
  {
    providerAction: "oiliness",
    key: "oiliness",
    providerLabel: "Oiliness",
    displayLabel: "Visible oiliness",
    experimentRole: "supporting"
  },
  {
    providerAction: "moisture",
    key: "hydration",
    providerLabel: "Moisture",
    displayLabel: "Visible hydration signal",
    experimentRole: "supporting"
  },
  {
    providerAction: "radiance",
    key: "radiance",
    providerLabel: "Radiance",
    displayLabel: "Radiance",
    experimentRole: "supporting"
  }
] as const;

const concernByAction = new Map(
  ROUTINE_SD_CONCERNS.map((definition) => [definition.providerAction, definition])
);

export function concernDefinitionForAction(action: string) {
  return concernByAction.get(action as RoutineSdAction);
}

export function resolveRoutineSdActions(requested?: string[]): RoutineSdAction[] {
  if (requested === undefined) return [...ROUTINE_SD_ACTIONS];
  const parsed = z.array(routineSdActionSchema).min(1).max(ROUTINE_SD_ACTIONS.length).safeParse(requested);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) {
    throw new Error("PROVIDER_ACTIONS_INVALID");
  }
  return parsed.data;
}
