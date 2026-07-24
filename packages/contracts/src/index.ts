import { z } from "zod";

export const concernSchema = z.object({
  key: z.string(),
  providerLabel: z.string(),
  rawScore: z.number().nullable(),
  normalizedSeverity: z.number().min(0).max(100).nullable(),
  directionSource: z.enum(["provider-doc", "configured", "unknown"])
});

export const scanSchema = z.object({
  id: z.string(),
  status: z.enum([
    "draft",
    "validating",
    "pending_upload",
    "uploaded",
    "task_created",
    "processing",
    "succeeded",
    "normalized",
    "validation_failed",
    "upload_failed",
    "provider_failed",
    "timed_out",
    "deleted"
  ]),
  capturedAt: z.string(),
  provider: z.enum(["youcam", "mock"]),
  concerns: z.array(concernSchema),
  captureWarnings: z.array(z.string())
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  brand: z.string().default(""),
  category: z.string(),
  startedAt: z.string(),
  cadence: z.enum(["daily", "few-times-week", "weekly"]),
  timeOfDay: z.enum(["AM", "PM", "AM + PM"]),
  active: z.boolean(),
  recentlyChanged: z.boolean()
});

export const associationComponentsSchema = z.object({
  imageTrend: z.number().min(0).max(100),
  selfReportTrend: z.number().min(0).max(100),
  adherence: z.number().min(0).max(100),
  repeatability: z.number().min(0).max(100),
  confounderPenalty: z.number().min(0).max(50),
  qualityPenalty: z.number().min(0).max(40)
});

export const associationResultSchema = z.object({
  associationLevel: z.enum(["insufficient", "low", "moderate", "strong"]),
  score: z.number().min(0).max(100).nullable(),
  components: associationComponentsSchema,
  usedConcerns: z.array(z.string()),
  limitations: z.array(z.string()),
  wording: z.string()
});

export const apiMetaSchema = z.object({
  requestId: z.string(),
  apiVersion: z.literal("v1")
});

export const apiFailureSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional()
  }),
  meta: apiMetaSchema
});

export const apiSuccessSchema = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, meta: apiMetaSchema.optional() });

export type Concern = z.infer<typeof concernSchema>;
export type Scan = z.infer<typeof scanSchema>;
export type Product = z.infer<typeof productSchema>;
export type AssociationComponents = z.infer<typeof associationComponentsSchema>;
export type AssociationResult = z.infer<typeof associationResultSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;

export type LocalImageAsset = {
  uri: string;
  mimeType: "image/jpeg" | "image/png";
  width: number;
  height: number;
  byteSize?: number;
  fileName?: string;
};

export type ApiSuccess<T> = {
  data: T;
  meta?: { requestId: string; apiVersion: "v1" };
};
