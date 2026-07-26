import { z } from "zod";

export const concernSchema = z.object({
  key: z.string(),
  providerLabel: z.string(),
  rawScore: z.number().nullable(),
  normalizedSeverity: z.number().min(0).max(100).nullable(),
  directionSource: z.enum(["provider-doc", "configured", "unknown"]),
  maskUrl: z.string().url().regex(/^https:\/\//i).optional()
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
  providerVersion: z.string().optional(),
  concerns: z.array(concernSchema),
  captureWarnings: z.array(z.string())
});

export const scanActivityEventSchema = z.object({
  id: z.string().min(1),
  at: z.string().datetime(),
  source: z.enum(["client", "storage", "skincause", "youcam", "mock"]),
  level: z.enum(["info", "success", "error"]),
  message: z.string().min(1).max(240)
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

export const productUpdateSchema = productSchema
  .omit({ id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one product field is required.");

export const checkInSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  scanId: z.string().nullable(),
  adherence: z.number().min(0).max(100),
  observation: z.number().min(0).max(10),
  confounders: z.array(z.string()),
  notes: z.string().nullable(),
  occurredAt: z.string()
});

export const createCheckInSchema = z.object({
  scanId: z.string().optional(),
  adherence: z.number().min(0).max(100),
  observation: z.number().min(0).max(10),
  confounders: z.array(z.string()).max(12).default([]),
  notes: z.string().max(2000).optional()
});

export const experimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["elimination", "reintroduction"]),
  status: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  suspectProductId: z.string(),
  suspectProductName: z.string(),
  hypothesis: z.string(),
  checkIns: z.array(checkInSchema)
});

export const createExperimentSchema = z.object({
  type: z.enum(["elimination", "reintroduction"]),
  suspectProductId: z.string().min(1),
  startedAt: z.string().min(1),
  hypothesis: z.string().min(10).max(1000)
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

export const scanUploadTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("supabase-signed"),
    bucket: z.string().min(1),
    path: z.string().min(1),
    token: z.string().min(1)
  }),
  z.object({
    type: z.literal("same-origin"),
    url: z.string().min(1),
    method: z.literal("PUT"),
    requiredHeaders: z.record(z.string(), z.string())
  })
]);

export const scanUploadSessionSchema = z.object({
  scanId: z.string().min(1),
  upload: scanUploadTargetSchema,
  expiresAt: z.string().min(1),
  activity: z.array(scanActivityEventSchema).optional()
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
export type ScanActivityEvent = z.infer<typeof scanActivityEventSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type CheckIn = z.infer<typeof checkInSchema>;
export type CreateCheckIn = z.infer<typeof createCheckInSchema>;
export type Experiment = z.infer<typeof experimentSchema>;
export type CreateExperiment = z.infer<typeof createExperimentSchema>;
export type AssociationComponents = z.infer<typeof associationComponentsSchema>;
export type AssociationResult = z.infer<typeof associationResultSchema>;
export type ScanUploadTarget = z.infer<typeof scanUploadTargetSchema>;
export type ScanUploadSession = z.infer<typeof scanUploadSessionSchema>;
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
