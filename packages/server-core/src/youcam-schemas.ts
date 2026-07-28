import { z } from "zod";

const httpsUrlSchema = z.string().url().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
});

export const youCamTaskStatusSchema = z.object({
  data: z.object({
    task_status: z.string(),
    error_code: z.string().nullish(),
    error: z.string().nullish(),
    results: z.object({
      output: z.array(z.object({
        type: z.string(),
        raw_score: z.number().min(0).max(100).nullish(),
        ui_score: z.number().min(0).max(100).nullish(),
        mask_urls: z.array(z.unknown()).nullish()
      }).passthrough()).nullish()
    }).nullish()
  }).passthrough()
}).passthrough();

export const youCamFileResponseSchema = z.object({
  data: z.object({
    files: z.array(z.object({
      file_id: z.string().min(1),
      requests: z.array(z.object({
        url: httpsUrlSchema,
        method: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional()
      }).passthrough()).min(1)
    }).passthrough()).min(1)
  }).passthrough()
}).passthrough();

export const youCamCreateTaskResponseSchema = z.object({
  data: z.object({
    task_id: z.string().min(1)
  }).passthrough()
}).passthrough();

export function firstSafeMaskUrl(values: unknown[] | null | undefined) {
  if (!values) return undefined;
  for (const value of values) {
    const parsed = httpsUrlSchema.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}
