import type {
  CheckIn,
  CreateCheckIn,
  CreateExperiment,
  Experiment,
  Product,
  ProductUpdate
} from "@skincause/contracts";
import {
  PersistentWorkspaceService,
  WorkspaceRuleError,
  type WorkspaceRepository
} from "@skincause/server-core";
import { scans } from "@skincause/domain";
import { describe, expect, it } from "vitest";

const product: Product = {
  id: crypto.randomUUID(),
  name: "Test serum",
  brand: "",
  category: "Serum",
  startedAt: "2026-07-01T08:00:00.000Z",
  cadence: "daily",
  timeOfDay: "PM",
  active: true,
  recentlyChanged: true
};

class MemoryWorkspaceRepository implements WorkspaceRepository {
  products = [product];
  experiments: Experiment[] = [];
  normalizedScans = new Set<string>();

  async listProducts() {
    return this.products;
  }

  async findProduct(_ownerId: string, productId: string) {
    return this.products.find((item) => item.id === productId) ?? null;
  }

  async createProduct(_ownerId: string, input: Product) {
    this.products.push(input);
    return input;
  }

  async updateProduct(_ownerId: string, productId: string, patch: ProductUpdate) {
    const index = this.products.findIndex((item) => item.id === productId);
    if (index < 0) return null;
    this.products[index] = { ...this.products[index], ...patch };
    return this.products[index];
  }

  async listExperiments() {
    return this.experiments;
  }

  async findExperiment(_ownerId: string, experimentId: string) {
    return this.experiments.find((item) => item.id === experimentId) ?? null;
  }

  async hasActiveExperiment() {
    return this.experiments.some((item) => item.status === "active");
  }

  async hasNormalizedScan() {
    return this.normalizedScans.size > 0;
  }

  async ownsNormalizedScan(_ownerId: string, scanId: string) {
    return this.normalizedScans.has(scanId);
  }

  async getNormalizedScan(_ownerId: string, scanId: string) {
    return this.normalizedScans.has(scanId) ? { ...scans[0], id: scanId } : null;
  }

  async createExperiment(_ownerId: string, input: CreateExperiment) {
    const created: Experiment = {
      id: crypto.randomUUID(),
      name: `${product.name} ${input.type}`,
      type: input.type,
      status: "active",
      startedAt: input.startedAt,
      endedAt: null,
      suspectProductId: input.suspectProductId,
      suspectProductName: product.name,
      hypothesis: input.hypothesis,
      baselineScanId: input.baselineScanId,
      analysisProfileVersion: input.analysisProfileVersion,
      primaryConcerns: input.primaryConcerns,
      checkIns: []
    };
    this.experiments.push(created);
    return created;
  }

  async createCheckIn(_ownerId: string, experiment: Experiment, input: CreateCheckIn) {
    const checkIn: CheckIn = {
      id: crypto.randomUUID(),
      experimentId: experiment.id,
      scanId: input.scanId ?? null,
      adherence: input.adherence,
      observation: input.observation,
      confounders: input.confounders,
      notes: input.notes ?? null,
      occurredAt: new Date().toISOString()
    };
    experiment.checkIns.push(checkIn);
    return checkIn;
  }
}

describe("persistent workspace service", () => {
  it("requires a baseline and only permits one active experiment", async () => {
    const repository = new MemoryWorkspaceRepository();
    const service = new PersistentWorkspaceService(repository);
    const baselineScanId = crypto.randomUUID();
    const input: CreateExperiment = {
      type: "elimination",
      suspectProductId: product.id,
      startedAt: "2026-07-24T08:00:00.000Z",
      hypothesis: "Observe whether the selected cosmetic concern changes.",
      baselineScanId,
      analysisProfileVersion: "routine-sd-v1",
      primaryConcerns: ["redness"]
    };

    await expect(service.createExperiment("owner-a", input)).rejects.toMatchObject({
      code: "BASELINE_REQUIRED"
    });
    repository.normalizedScans.add(baselineScanId);
    await expect(service.createExperiment("owner-a", input)).resolves.toMatchObject({
      status: "active",
      suspectProductId: product.id
    });
    await expect(service.createExperiment("owner-a", input)).rejects.toMatchObject({
      code: "ACTIVE_EXPERIMENT_EXISTS"
    });
  });

  it("only attaches an owned normalized scan to an active experiment", async () => {
    const repository = new MemoryWorkspaceRepository();
    const service = new PersistentWorkspaceService(repository);
    const scanId = crypto.randomUUID();
    repository.normalizedScans.add(scanId);
    const experiment = await service.createExperiment("owner-a", {
      type: "elimination",
      suspectProductId: product.id,
      startedAt: "2026-07-24T08:00:00.000Z",
      hypothesis: "Observe whether the selected cosmetic concern changes.",
      baselineScanId: scanId,
      analysisProfileVersion: "routine-sd-v1",
      primaryConcerns: ["redness"]
    });

    await expect(service.createCheckIn("owner-a", experiment.id, {
      scanId: crypto.randomUUID(),
      adherence: 100,
      observation: 4,
      confounders: []
    })).rejects.toBeInstanceOf(WorkspaceRuleError);

    await expect(service.createCheckIn("owner-a", experiment.id, {
      scanId,
      adherence: 100,
      observation: 4,
      confounders: ["Unusual sun exposure"]
    })).resolves.toMatchObject({
      experimentId: experiment.id,
      scanId,
      adherence: 100,
      observation: 4
    });
  });
});
