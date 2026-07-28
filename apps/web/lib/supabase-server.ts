import {
  MockRoutineRecommendationProvider,
  MockSkinSimulationProvider,
  OpenAiRoutineRecommendationProvider,
  PersistentScanService,
  PersistentRoutineRecommendationService,
  PersistentSkinSimulationService,
  PersistentWorkspaceService,
  YouCamSkinSimulationProvider,
  type ScanImageStore,
  type ScanRepository,
  type SkinSimulationImageStore,
  type SkinSimulationRepository,
  type StoredScan,
  type StoredScanPatch,
  type StoredRoutineRecommendation,
  type StoredSkinSimulation,
  type StoredSkinSimulationPatch,
  type RoutineRecommendationRepository,
  WorkspaceRuleError,
  type WorkspaceRepository
} from "@skincause/server-core";
import type {
  CheckIn,
  Concern,
  CreateCheckIn,
  CreateExperiment,
  Experiment,
  Product,
  ProductUpdate
} from "@skincause/contracts";
import {
  routineRecommendationSchema,
  skinSimulationParametersSchema
} from "@skincause/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateLongitudinalAssociation,
  calculateSkinSimulationParameters
} from "@skincause/domain";

type ScanRow = {
  id: string;
  user_id: string;
  status: StoredScan["status"];
  provider: StoredScan["provider"];
  provider_version: string | null;
  analysis_profile_version: string;
  external_task_id: string | null;
  captured_at: string | null;
  image_path: string | null;
  retain_image: boolean;
  client_request_id: string;
  created_at: string;
};

type ConcernRow = {
  scan_id: string;
  concern_key: string;
  raw_score: number | string | null;
  ui_score: number | string | null;
  normalized_severity: number | string | null;
  direction_source: Concern["directionSource"];
  display_label: string | null;
  experiment_role: Concern["experimentRole"] | null;
};

type RoutinePeriodRow = {
  id: string;
  product_id: string;
  started_at: string;
  ended_at: string | null;
  cadence: string;
  time_of_day: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: string;
  notes: string | null;
  created_at: string;
  routine_periods?: RoutinePeriodRow[];
};

type ExperimentRow = {
  id: string;
  user_id: string;
  type: "elimination" | "reintroduction";
  suspect_product_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  hypothesis: string;
  baseline_scan_id: string | null;
  analysis_profile_version: string;
  primary_concerns: string[];
};

type CheckInRow = {
  id: string;
  experiment_id: string;
  scan_id: string | null;
  adherence: number | string;
  observations: {
    rating?: number;
    confounders?: string[];
  } | null;
  notes: string | null;
  occurred_at: string;
};

type RecommendationRow = {
  experiment_id: string;
  user_id: string;
  input_hash: string;
  model: string;
  recommendation: unknown;
  created_at: string;
  updated_at: string;
};

type SkinSimulationRow = {
  experiment_id: string;
  user_id: string;
  source_scan_id: string | null;
  target_scan_id: string | null;
  status: StoredSkinSimulation["status"];
  provider: StoredSkinSimulation["provider"];
  provider_version: string;
  external_task_id: string | null;
  input_hash: string;
  parameters: unknown;
  result_path: string | null;
  result_mime_type: StoredSkinSimulation["resultMimeType"];
  error_code: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RequestActor =
  | { kind: "guest" }
  | {
      kind: "authenticated";
      userId: string;
      email: string | null;
      displayName: string;
      client: SupabaseClient;
    };

export class AuthenticationError extends Error {}

function requiredServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  }
  return { url, publishableKey, secretKey };
}

function userClient(accessToken: string) {
  const { url, publishableKey } = requiredServerConfig();
  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

function adminClient() {
  const { url, secretKey } = requiredServerConfig();
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

function toStoredScan(row: ScanRow): StoredScan {
  return {
    id: row.id,
    ownerId: row.user_id,
    status: row.status,
    provider: row.provider,
    providerVersion: row.provider_version,
    analysisProfileVersion: row.analysis_profile_version,
    externalTaskId: row.external_task_id,
    capturedAt: row.captured_at ?? row.created_at,
    imagePath: row.image_path,
    retainImage: row.retain_image,
    clientRequestId: row.client_request_id
  };
}

function labelForConcern(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapProduct(row: ProductRow): Product {
  const periods = [...(row.routine_periods ?? [])].sort(
    (left, right) => new Date(left.started_at).getTime() - new Date(right.started_at).getTime()
  );
  const current = [...periods].reverse().find((period) => period.ended_at === null) ?? periods.at(-1);
  const startedAt = periods.at(0)?.started_at ?? row.created_at;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    category: row.category,
    startedAt,
    cadence: current?.cadence === "weekly"
      ? "weekly"
      : current?.cadence === "few-times-week"
        ? "few-times-week"
        : "daily",
    timeOfDay: current?.time_of_day === "AM"
      ? "AM"
      : current?.time_of_day === "AM + PM"
        ? "AM + PM"
        : "PM",
    active: Boolean(current && current.ended_at === null),
    recentlyChanged: new Date(startedAt).getTime() >= Date.now() - 60 * 24 * 60 * 60 * 1000
  };
}

function mapCheckIn(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    scanId: row.scan_id,
    adherence: Number(row.adherence),
    observation: Number(row.observations?.rating ?? 0),
    confounders: Array.isArray(row.observations?.confounders)
      ? row.observations.confounders.filter((value): value is string => typeof value === "string")
      : [],
    notes: row.notes,
    occurredAt: row.occurred_at
  };
}

export class SupabaseScanRepository implements ScanRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByClientRequestId(ownerId: string, clientRequestId: string) {
    const { data, error } = await this.client
      .from("scans")
      .select("*")
      .eq("user_id", ownerId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (error) throw error;
    return data ? toStoredScan(data as ScanRow) : null;
  }

  async findById(ownerId: string, scanId: string) {
    const { data, error } = await this.client
      .from("scans")
      .select("*")
      .eq("user_id", ownerId)
      .eq("id", scanId)
      .maybeSingle();
    if (error) throw error;
    return data ? toStoredScan(data as ScanRow) : null;
  }

  async create(scan: StoredScan) {
    const { data, error } = await this.client
      .from("scans")
      .insert({
        id: scan.id,
        user_id: scan.ownerId,
        status: scan.status,
        provider: scan.provider,
        provider_version: scan.providerVersion,
        analysis_profile_version: scan.analysisProfileVersion,
        external_task_id: scan.externalTaskId,
        captured_at: scan.capturedAt,
        image_path: scan.imagePath,
        retain_image: scan.retainImage,
        client_request_id: scan.clientRequestId
      })
      .select("*")
      .single();
    if (error) throw error;
    return toStoredScan(data as ScanRow);
  }

  async update(ownerId: string, scanId: string, patch: StoredScanPatch) {
    const databasePatch: Record<string, unknown> = {};
    if (patch.status !== undefined) databasePatch.status = patch.status;
    if (patch.providerVersion !== undefined) databasePatch.provider_version = patch.providerVersion;
    if (patch.analysisProfileVersion !== undefined) {
      databasePatch.analysis_profile_version = patch.analysisProfileVersion;
    }
    if (patch.externalTaskId !== undefined) databasePatch.external_task_id = patch.externalTaskId;
    if (patch.capturedAt !== undefined) databasePatch.captured_at = patch.capturedAt;
    if (patch.imagePath !== undefined) databasePatch.image_path = patch.imagePath;
    if (patch.retainImage !== undefined) databasePatch.retain_image = patch.retainImage;

    const { data, error } = await this.client
      .from("scans")
      .update(databasePatch)
      .eq("user_id", ownerId)
      .eq("id", scanId)
      .select("*")
      .single();
    if (error) throw error;
    return toStoredScan(data as ScanRow);
  }

  async listConcerns(ownerId: string, scanId: string) {
    const scan = await this.findById(ownerId, scanId);
    if (!scan) return [];
    const { data, error } = await this.client
      .from("scan_concerns")
      .select("*")
      .eq("scan_id", scanId)
      .order("concern_key");
    if (error) throw error;
    return ((data ?? []) as ConcernRow[]).map((row) => ({
      key: row.concern_key,
      providerLabel: labelForConcern(row.concern_key),
      displayLabel: row.display_label ?? labelForConcern(row.concern_key),
      rawScore: row.raw_score === null ? null : Number(row.raw_score),
      uiScore: row.ui_score === null ? null : Number(row.ui_score),
      normalizedSeverity: row.normalized_severity === null ? null : Number(row.normalized_severity),
      directionSource: row.direction_source,
      ...(row.experiment_role ? { experimentRole: row.experiment_role } : {})
    }));
  }

  async replaceConcerns(ownerId: string, scanId: string, concerns: Concern[]) {
    const scan = await this.findById(ownerId, scanId);
    if (!scan) throw new Error("SCAN_NOT_FOUND");
    const deleted = await this.client.from("scan_concerns").delete().eq("scan_id", scanId);
    if (deleted.error) throw deleted.error;
    if (concerns.length === 0) return;
    const inserted = await this.client.from("scan_concerns").insert(
      concerns.map((concern) => ({
        scan_id: scanId,
        concern_key: concern.key,
        raw_score: concern.rawScore,
        ui_score: concern.uiScore ?? null,
        normalized_severity: concern.normalizedSeverity,
        direction_source: concern.directionSource,
        display_label: concern.displayLabel ?? concern.providerLabel,
        experiment_role: concern.experimentRole ?? null
      }))
    );
    if (inserted.error) throw inserted.error;
  }
}

export class SupabaseScanImageStore implements ScanImageStore {
  private readonly client = adminClient();
  private readonly bucket = "scan-images";

  async put(path: string, image: Uint8Array, mimeType: "image/jpeg" | "image/png") {
    const { error } = await this.client.storage.from(this.bucket).upload(path, image, {
      contentType: mimeType,
      upsert: true
    });
    if (error) throw error;
  }

  async get(path: string) {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error) {
      if (error.message.toLowerCase().includes("not found")) return null;
      throw error;
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async remove(path: string) {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) throw error;
  }
}

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listProducts(ownerId: string) {
    const { data, error } = await this.client
      .from("products")
      .select("*, routine_periods(*)")
      .eq("user_id", ownerId)
      .order("created_at");
    if (error) throw error;
    return ((data ?? []) as ProductRow[]).map(mapProduct);
  }

  async findProduct(ownerId: string, productId: string) {
    const { data, error } = await this.client
      .from("products")
      .select("*, routine_periods(*)")
      .eq("user_id", ownerId)
      .eq("id", productId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProduct(data as ProductRow) : null;
  }

  async createProduct(ownerId: string, product: Product) {
    const created = await this.client.from("products").insert({
      id: product.id,
      user_id: ownerId,
      name: product.name,
      brand: product.brand || null,
      category: product.category
    });
    if (created.error) throw created.error;

    const period = await this.client.from("routine_periods").insert({
      product_id: product.id,
      started_at: product.startedAt,
      cadence: product.cadence,
      time_of_day: product.timeOfDay,
      ended_at: product.active ? null : product.startedAt
    });
    if (period.error) {
      await this.client.from("products").delete().eq("user_id", ownerId).eq("id", product.id);
      throw period.error;
    }
    return (await this.findProduct(ownerId, product.id))!;
  }

  async updateProduct(ownerId: string, productId: string, patch: ProductUpdate) {
    const existing = await this.findProduct(ownerId, productId);
    if (!existing) return null;

    const productPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) productPatch.name = patch.name;
    if (patch.brand !== undefined) productPatch.brand = patch.brand || null;
    if (patch.category !== undefined) productPatch.category = patch.category;
    if (Object.keys(productPatch).length > 0) {
      const updated = await this.client
        .from("products")
        .update(productPatch)
        .eq("user_id", ownerId)
        .eq("id", productId);
      if (updated.error) throw updated.error;
    }

    const changesSchedule =
      patch.cadence !== undefined ||
      patch.timeOfDay !== undefined ||
      patch.startedAt !== undefined;
    if (patch.active === false && existing.active) {
      const ended = await this.client
        .from("routine_periods")
        .update({ ended_at: new Date().toISOString() })
        .eq("product_id", productId)
        .is("ended_at", null);
      if (ended.error) throw ended.error;
    } else if ((patch.active === true && !existing.active) || (changesSchedule && existing.active)) {
      if (existing.active) {
        const ended = await this.client
          .from("routine_periods")
          .update({ ended_at: new Date().toISOString() })
          .eq("product_id", productId)
          .is("ended_at", null);
        if (ended.error) throw ended.error;
      }
      const inserted = await this.client.from("routine_periods").insert({
        product_id: productId,
        started_at: patch.startedAt ?? new Date().toISOString(),
        cadence: patch.cadence ?? existing.cadence,
        time_of_day: patch.timeOfDay ?? existing.timeOfDay,
        ended_at: null
      });
      if (inserted.error) throw inserted.error;
    }

    return this.findProduct(ownerId, productId);
  }

  async listExperiments(ownerId: string) {
    const { data, error } = await this.client
      .from("experiments")
      .select("*")
      .eq("user_id", ownerId)
      .order("started_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as ExperimentRow[];
    return Promise.all(rows.map((row) => this.mapExperiment(ownerId, row)));
  }

  async findExperiment(ownerId: string, experimentId: string) {
    const { data, error } = await this.client
      .from("experiments")
      .select("*")
      .eq("user_id", ownerId)
      .eq("id", experimentId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapExperiment(ownerId, data as ExperimentRow) : null;
  }

  async hasActiveExperiment(ownerId: string) {
    const { count, error } = await this.client
      .from("experiments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .eq("status", "active");
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async hasNormalizedScan(ownerId: string) {
    const { count, error } = await this.client
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .in("status", ["normalized", "succeeded"]);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async ownsNormalizedScan(ownerId: string, scanId: string) {
    const { count, error } = await this.client
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .eq("id", scanId)
      .in("status", ["normalized", "succeeded"]);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async getNormalizedScan(ownerId: string, scanId: string) {
    const { data, error } = await this.client
      .from("scans")
      .select("*")
      .eq("user_id", ownerId)
      .eq("id", scanId)
      .in("status", ["normalized", "succeeded"])
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as ScanRow;
    const concerns = await new SupabaseScanRepository(this.client).listConcerns(ownerId, scanId);
    return {
      id: row.id,
      status: row.status,
      capturedAt: row.captured_at ?? row.created_at,
      provider: row.provider,
      providerVersion: row.provider_version ?? undefined,
      analysisProfileVersion: row.analysis_profile_version,
      concerns,
      captureWarnings: []
    };
  }

  async createExperiment(ownerId: string, input: CreateExperiment) {
    const id = crypto.randomUUID();
    const { data, error } = await this.client
      .from("experiments")
      .insert({
        id,
        user_id: ownerId,
        type: input.type,
        suspect_product_id: input.suspectProductId,
        status: "active",
        started_at: input.startedAt,
        hypothesis: input.hypothesis,
        baseline_scan_id: input.baselineScanId,
        analysis_profile_version: input.analysisProfileVersion,
        primary_concerns: input.primaryConcerns
      })
      .select("*")
      .single();
    if (error) throw error;
    return this.mapExperiment(ownerId, data as ExperimentRow);
  }

  async createCheckIn(ownerId: string, experiment: Experiment, input: CreateCheckIn) {
    const { data, error } = await this.client
      .from("check_ins")
      .insert({
        id: crypto.randomUUID(),
        experiment_id: experiment.id,
        scan_id: input.scanId ?? null,
        adherence: input.adherence,
        observations: {
          rating: input.observation,
          confounders: input.confounders
        },
        notes: input.notes?.trim() || null,
        occurred_at: new Date().toISOString()
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapCheckIn(data as CheckInRow);
  }

  private async mapExperiment(ownerId: string, row: ExperimentRow): Promise<Experiment> {
    const [productResult, checkInsResult] = await Promise.all([
      this.client
        .from("products")
        .select("name")
        .eq("user_id", ownerId)
        .eq("id", row.suspect_product_id)
        .maybeSingle(),
      this.client
        .from("check_ins")
        .select("*")
        .eq("experiment_id", row.id)
        .order("occurred_at")
    ]);
    if (productResult.error) throw productResult.error;
    if (checkInsResult.error) throw checkInsResult.error;
    const suspectProductName =
      typeof productResult.data?.name === "string" ? productResult.data.name : "Selected product";
    const checkIns = ((checkInsResult.data ?? []) as CheckInRow[]).map(mapCheckIn);
    const baseline = row.baseline_scan_id
      ? await this.getNormalizedScan(ownerId, row.baseline_scan_id)
      : null;
    const followUps = (await Promise.all(
      checkIns.flatMap((checkIn) =>
        checkIn.scanId ? [this.getNormalizedScan(ownerId, checkIn.scanId)] : []
      )
    )).filter((scan): scan is NonNullable<typeof scan> => scan !== null);
    const result = baseline
      ? calculateLongitudinalAssociation({
          experimentType: row.type,
          baseline,
          followUps,
          checkIns,
          primaryConcerns: row.primary_concerns
        })
      : undefined;
    return {
      id: row.id,
      name: `${suspectProductName} ${row.type}`,
      type: row.type,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      suspectProductId: row.suspect_product_id,
      suspectProductName,
      hypothesis: row.hypothesis,
      baselineScanId: row.baseline_scan_id,
      analysisProfileVersion: row.analysis_profile_version,
      primaryConcerns: row.primary_concerns,
      ...(result ? { result } : {}),
      checkIns
    };
  }
}

export class SupabaseRoutineRecommendationRepository
implements RoutineRecommendationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async find(ownerId: string, experimentId: string) {
    const { data, error } = await this.client
      .from("experiment_recommendations")
      .select("*")
      .eq("user_id", ownerId)
      .eq("experiment_id", experimentId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as RecommendationRow;
    const recommendation = routineRecommendationSchema.parse(row.recommendation);
    return {
      ownerId: row.user_id,
      experimentId: row.experiment_id,
      inputHash: row.input_hash,
      recommendation
    };
  }

  async upsert(record: StoredRoutineRecommendation) {
    const { data, error } = await this.client
      .from("experiment_recommendations")
      .upsert({
        experiment_id: record.experimentId,
        user_id: record.ownerId,
        input_hash: record.inputHash,
        model: record.recommendation.model,
        recommendation: record.recommendation,
        created_at: record.recommendation.generatedAt,
        updated_at: record.recommendation.generatedAt
      }, { onConflict: "experiment_id" })
      .select("*")
      .single();
    if (error) throw error;
    const row = data as RecommendationRow;
    return {
      ownerId: row.user_id,
      experimentId: row.experiment_id,
      inputHash: row.input_hash,
      recommendation: routineRecommendationSchema.parse(row.recommendation)
    };
  }
}

function mapSkinSimulation(row: SkinSimulationRow): StoredSkinSimulation {
  if (!row.source_scan_id || !row.target_scan_id) {
    throw new Error("SIMULATION_SCAN_REFERENCE_MISSING");
  }
  return {
    ownerId: row.user_id,
    experimentId: row.experiment_id,
    sourceScanId: row.source_scan_id,
    targetScanId: row.target_scan_id,
    status: row.status,
    provider: row.provider,
    providerVersion: row.provider_version,
    externalTaskId: row.external_task_id,
    inputHash: row.input_hash,
    parameters: skinSimulationParametersSchema.parse(row.parameters),
    resultPath: row.result_path,
    resultMimeType: row.result_mime_type,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at
  };
}

export class SupabaseSkinSimulationRepository implements SkinSimulationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async find(ownerId: string, experimentId: string) {
    const { data, error } = await this.client
      .from("skin_simulations")
      .select("*")
      .eq("user_id", ownerId)
      .eq("experiment_id", experimentId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSkinSimulation(data as SkinSimulationRow) : null;
  }

  async upsert(record: StoredSkinSimulation) {
    const { data, error } = await this.client
      .from("skin_simulations")
      .upsert({
        experiment_id: record.experimentId,
        user_id: record.ownerId,
        source_scan_id: record.sourceScanId,
        target_scan_id: record.targetScanId,
        status: record.status,
        provider: record.provider,
        provider_version: record.providerVersion,
        external_task_id: record.externalTaskId,
        input_hash: record.inputHash,
        parameters: record.parameters,
        result_path: record.resultPath,
        result_mime_type: record.resultMimeType,
        error_code: record.errorCode,
        expires_at: record.expiresAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt
      }, { onConflict: "experiment_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapSkinSimulation(data as SkinSimulationRow);
  }

  async update(
    ownerId: string,
    experimentId: string,
    patch: StoredSkinSimulationPatch
  ) {
    const databasePatch: Record<string, unknown> = {};
    if (patch.status !== undefined) databasePatch.status = patch.status;
    if (patch.externalTaskId !== undefined) databasePatch.external_task_id = patch.externalTaskId;
    if (patch.resultPath !== undefined) databasePatch.result_path = patch.resultPath;
    if (patch.resultMimeType !== undefined) {
      databasePatch.result_mime_type = patch.resultMimeType;
    }
    if (patch.errorCode !== undefined) databasePatch.error_code = patch.errorCode;
    if (patch.updatedAt !== undefined) databasePatch.updated_at = patch.updatedAt;
    if (patch.expiresAt !== undefined) databasePatch.expires_at = patch.expiresAt;
    const { data, error } = await this.client
      .from("skin_simulations")
      .update(databasePatch)
      .eq("user_id", ownerId)
      .eq("experiment_id", experimentId)
      .select("*")
      .single();
    if (error) throw error;
    return mapSkinSimulation(data as SkinSimulationRow);
  }
}

export class SupabaseSkinSimulationImageStore implements SkinSimulationImageStore {
  private readonly client = adminClient();
  private readonly bucket = "simulation-images";

  async put(
    path: string,
    image: Uint8Array,
    mimeType: "image/jpeg" | "image/png"
  ) {
    const { error } = await this.client.storage.from(this.bucket).upload(path, image, {
      contentType: mimeType,
      upsert: true
    });
    if (error) throw error;
  }

  async get(path: string) {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error) {
      if (error.message.toLowerCase().includes("not found")) return null;
      throw error;
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async remove(path: string) {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) throw error;
  }
}

export async function resolveRequestActor(request: Request): Promise<RequestActor> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return { kind: "guest" };
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) throw new AuthenticationError("A valid bearer token is required.");

  const accessToken = match[1];
  const client = userClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new AuthenticationError("The Supabase session is invalid or expired.");

  const displayName =
    typeof data.user.user_metadata?.display_name === "string"
      ? data.user.user_metadata.display_name
      : data.user.email?.split("@")[0] ?? "SkinCause user";
  const profile = await client
    .from("profiles")
    .upsert({ id: data.user.id, display_name: displayName }, { onConflict: "id" });
  if (profile.error) throw profile.error;

  return {
    kind: "authenticated",
    userId: data.user.id,
    email: data.user.email ?? null,
    displayName,
    client
  };
}

export function createPersistentScanService(actor: Extract<RequestActor, { kind: "authenticated" }>) {
  return new PersistentScanService(
    new SupabaseScanRepository(actor.client),
    new SupabaseScanImageStore()
  );
}

export async function createSignedScanUpload(scan: StoredScan) {
  if (!scan.imagePath) throw new Error("SCAN_UPLOAD_PATH_MISSING");
  const bucket = "scan-images";
  const { data, error } = await adminClient()
    .storage
    .from(bucket)
    .createSignedUploadUrl(scan.imagePath, { upsert: false });
  if (error) throw error;
  return {
    type: "supabase-signed" as const,
    bucket,
    path: data.path,
    token: data.token
  };
}

export function createPersistentWorkspaceService(actor: Extract<RequestActor, { kind: "authenticated" }>) {
  return new PersistentWorkspaceService(new SupabaseWorkspaceRepository(actor.client));
}

export function createPersistentRoutineRecommendationService(
  actor: Extract<RequestActor, { kind: "authenticated" }>
) {
  const provider = process.env.OPENAI_MOCK_MODE !== "false"
    ? new MockRoutineRecommendationProvider()
    : new OpenAiRoutineRecommendationProvider(
        process.env.OPENAI_API_KEY ?? "",
        process.env.OPENAI_RECOMMENDATION_MODEL ?? "gpt-5.6-sol",
        process.env.OPENAI_API_BASE_URL
      );
  return new PersistentRoutineRecommendationService(
    new SupabaseRoutineRecommendationRepository(actor.client),
    provider
  );
}

export function createPersistentSkinSimulationService(
  actor: Extract<RequestActor, { kind: "authenticated" }>,
  mockResultUrl: string
) {
  const provider = process.env.YOUCAM_MOCK_MODE !== "false"
    ? new MockSkinSimulationProvider(mockResultUrl)
    : new YouCamSkinSimulationProvider(
        process.env.YOUCAM_API_KEY ?? "",
        process.env.YOUCAM_SIMULATION_API_URL
      );
  return new PersistentSkinSimulationService(
    new SupabaseSkinSimulationRepository(actor.client),
    new SupabaseSkinSimulationImageStore(),
    provider
  );
}

export async function getExperimentSimulationContext(
  actor: Extract<RequestActor, { kind: "authenticated" }>,
  experiment: Experiment
) {
  if (!experiment.baselineScanId) {
    throw new WorkspaceRuleError(
      "SIMULATION_BASELINE_REQUIRED",
      "A baseline scan is required before generating an illustration.",
      409
    );
  }
  const targetScanId = [...experiment.checkIns]
    .reverse()
    .find((checkIn) => checkIn.scanId)?.scanId;
  if (!targetScanId) {
    throw new WorkspaceRuleError(
      "SIMULATION_FOLLOW_UP_REQUIRED",
      "Add a comparable follow-up scan before generating the after-experiment illustration.",
      409
    );
  }
  const scanRepository = new SupabaseScanRepository(actor.client);
  const sourceScan = await scanRepository.findById(actor.userId, experiment.baselineScanId);
  if (!sourceScan?.imagePath || !sourceScan.retainImage) {
    throw new WorkspaceRuleError(
      "SIMULATION_SOURCE_IMAGE_UNAVAILABLE",
      "The baseline original was deleted. A retained baseline image is required for simulation.",
      409
    );
  }
  const workspaceRepository = new SupabaseWorkspaceRepository(actor.client);
  const [baselineScan, targetScan] = await Promise.all([
    workspaceRepository.getNormalizedScan(actor.userId, experiment.baselineScanId),
    workspaceRepository.getNormalizedScan(actor.userId, targetScanId)
  ]);
  if (!baselineScan || !targetScan) {
    throw new WorkspaceRuleError(
      "SIMULATION_FOLLOW_UP_UNAVAILABLE",
      "Comparable baseline and follow-up measurements are required for simulation.",
      409
    );
  }
  const { data, error } = await adminClient()
    .storage
    .from("scan-images")
    .createSignedUrl(sourceScan.imagePath, 10 * 60);
  if (error) throw error;
  const parameters = calculateSkinSimulationParameters(baselineScan, targetScan);
  if (Object.values(parameters).every((value) => value === 0)) {
    throw new WorkspaceRuleError(
      "SIMULATION_NO_POSITIVE_CHANGE",
      "The follow-up has no positive measured change that YouCam can illustrate.",
      409
    );
  }
  return {
    experimentId: experiment.id,
    sourceScanId: sourceScan.id,
    targetScanId,
    sourceImageUrl: data.signedUrl,
    parameters
  };
}

export async function deleteAuthenticatedAccount(
  actor: Extract<RequestActor, { kind: "authenticated" }>
) {
  const admin = adminClient();
  const { data: simulations, error: simulationsError } = await admin
    .from("skin_simulations")
    .select("result_path")
    .eq("user_id", actor.userId)
    .not("result_path", "is", null);
  if (simulationsError) throw simulationsError;
  const simulationPaths = (simulations ?? []).flatMap((simulation) =>
    typeof simulation.result_path === "string" ? [simulation.result_path] : []
  );
  if (simulationPaths.length > 0) {
    const removedSimulations = await admin.storage
      .from("simulation-images")
      .remove(simulationPaths);
    if (removedSimulations.error) throw removedSimulations.error;
  }

  const { data: scans, error: scansError } = await admin
    .from("scans")
    .select("image_path")
    .eq("user_id", actor.userId)
    .not("image_path", "is", null);
  if (scansError) throw scansError;
  const imagePaths = (scans ?? []).flatMap((scan) =>
    typeof scan.image_path === "string" ? [scan.image_path] : []
  );
  if (imagePaths.length > 0) {
    const removedImages = await admin.storage.from("scan-images").remove(imagePaths);
    if (removedImages.error) throw removedImages.error;
  }

  for (const [table, column] of [
    ["experiments", "user_id"],
    ["products", "user_id"],
    ["scans", "user_id"],
    ["profiles", "id"]
  ] as const) {
    const deleted = await admin.from(table).delete().eq(column, actor.userId);
    if (deleted.error) throw deleted.error;
  }

  const deletedUser = await admin.auth.admin.deleteUser(actor.userId);
  if (deletedUser.error) throw deletedUser.error;
}
