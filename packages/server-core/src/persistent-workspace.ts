import type {
  CheckIn,
  CreateCheckIn,
  CreateExperiment,
  Experiment,
  Product,
  ProductUpdate
} from "@skincause/contracts";

export interface WorkspaceRepository {
  listProducts(ownerId: string): Promise<Product[]>;
  findProduct(ownerId: string, productId: string): Promise<Product | null>;
  createProduct(ownerId: string, product: Product): Promise<Product>;
  updateProduct(ownerId: string, productId: string, patch: ProductUpdate): Promise<Product | null>;
  listExperiments(ownerId: string): Promise<Experiment[]>;
  findExperiment(ownerId: string, experimentId: string): Promise<Experiment | null>;
  hasActiveExperiment(ownerId: string): Promise<boolean>;
  hasNormalizedScan(ownerId: string): Promise<boolean>;
  ownsNormalizedScan(ownerId: string, scanId: string): Promise<boolean>;
  createExperiment(ownerId: string, input: CreateExperiment): Promise<Experiment>;
  createCheckIn(
    ownerId: string,
    experiment: Experiment,
    input: CreateCheckIn
  ): Promise<CheckIn>;
}

export class WorkspaceRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export class PersistentWorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  listProducts(ownerId: string) {
    return this.repository.listProducts(ownerId);
  }

  createProduct(ownerId: string, product: Product) {
    return this.repository.createProduct(ownerId, product);
  }

  async updateProduct(ownerId: string, productId: string, patch: ProductUpdate) {
    const product = await this.repository.updateProduct(ownerId, productId, patch);
    if (!product) {
      throw new WorkspaceRuleError("PRODUCT_NOT_FOUND", "The product was not found.", 404);
    }
    return product;
  }

  listExperiments(ownerId: string) {
    return this.repository.listExperiments(ownerId);
  }

  async getExperiment(ownerId: string, experimentId: string) {
    const experiment = await this.repository.findExperiment(ownerId, experimentId);
    if (!experiment) {
      throw new WorkspaceRuleError("EXPERIMENT_NOT_FOUND", "The experiment was not found.", 404);
    }
    return experiment;
  }

  async createExperiment(ownerId: string, input: CreateExperiment) {
    const product = await this.repository.findProduct(ownerId, input.suspectProductId);
    if (!product) {
      throw new WorkspaceRuleError("PRODUCT_NOT_FOUND", "Choose a product from your routine.", 404);
    }
    if (await this.repository.hasActiveExperiment(ownerId)) {
      throw new WorkspaceRuleError(
        "ACTIVE_EXPERIMENT_EXISTS",
        "Complete the active experiment before starting another.",
        409
      );
    }
    if (!(await this.repository.hasNormalizedScan(ownerId))) {
      throw new WorkspaceRuleError(
        "BASELINE_REQUIRED",
        "Complete a baseline scan before starting an experiment.",
        409
      );
    }
    return this.repository.createExperiment(ownerId, input);
  }

  async createCheckIn(ownerId: string, experimentId: string, input: CreateCheckIn) {
    const experiment = await this.repository.findExperiment(ownerId, experimentId);
    if (!experiment) {
      throw new WorkspaceRuleError("EXPERIMENT_NOT_FOUND", "The experiment was not found.", 404);
    }
    if (experiment.status !== "active") {
      throw new WorkspaceRuleError(
        "EXPERIMENT_NOT_ACTIVE",
        "Check-ins can only be added to an active experiment.",
        409
      );
    }
    if (input.scanId && !(await this.repository.ownsNormalizedScan(ownerId, input.scanId))) {
      throw new WorkspaceRuleError(
        "SCAN_NOT_AVAILABLE",
        "The selected scan is not available for this workspace.",
        404
      );
    }
    return this.repository.createCheckIn(ownerId, experiment, input);
  }
}
