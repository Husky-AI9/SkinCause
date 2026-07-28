import type { Concern } from "@skincause/contracts";
import {
  MockSkinAnalysisProvider,
  PersistentScanService,
  type ScanImageStore,
  type ScanRepository,
  type StoredScan,
  type StoredScanPatch
} from "@skincause/server-core";
import { describe, expect, it } from "vitest";

class MemoryScanRepository implements ScanRepository {
  readonly scans = new Map<string, StoredScan>();
  readonly concerns = new Map<string, Concern[]>();

  async findByClientRequestId(ownerId: string, clientRequestId: string) {
    return [...this.scans.values()].find(
      (scan) => scan.ownerId === ownerId && scan.clientRequestId === clientRequestId
    ) ?? null;
  }

  async findById(ownerId: string, scanId: string) {
    const scan = this.scans.get(scanId);
    return scan?.ownerId === ownerId ? scan : null;
  }

  async create(scan: StoredScan) {
    this.scans.set(scan.id, scan);
    return scan;
  }

  async update(ownerId: string, scanId: string, patch: StoredScanPatch) {
    const current = await this.findById(ownerId, scanId);
    if (!current) throw new Error("SCAN_NOT_FOUND");
    const updated = { ...current, ...patch };
    this.scans.set(scanId, updated);
    return updated;
  }

  async listConcerns(ownerId: string, scanId: string) {
    return (await this.findById(ownerId, scanId)) ? this.concerns.get(scanId) ?? [] : [];
  }

  async replaceConcerns(ownerId: string, scanId: string, concerns: Concern[]) {
    if (!(await this.findById(ownerId, scanId))) throw new Error("SCAN_NOT_FOUND");
    this.concerns.set(scanId, concerns);
  }
}

class MemoryImageStore implements ScanImageStore {
  readonly images = new Map<string, Uint8Array>();

  async put(path: string, image: Uint8Array) {
    this.images.set(path, image);
  }

  async get(path: string) {
    return this.images.get(path) ?? null;
  }

  async remove(path: string) {
    this.images.delete(path);
  }
}

describe("persistent scan service", () => {
  it("accepts a verified direct-storage upload without process-local state", async () => {
    const repository = new MemoryScanRepository();
    const images = new MemoryImageStore();
    const service = new PersistentScanService(repository, images);
    const scan = await service.createUploadSession("owner-a", crypto.randomUUID(), {
      mimeType: "image/jpeg",
      byteSize: 3,
      provider: "mock"
    });

    await images.put(scan.imagePath!, new Uint8Array([1, 2, 3]));
    await expect(
      service.submitScan("owner-a", scan.id, new MockSkinAnalysisProvider())
    ).resolves.toMatchObject({ scanId: scan.id, status: "processing" });
    expect(images.images.size).toBe(1);
    await service.getScan("owner-a", scan.id, new MockSkinAnalysisProvider());
    expect(images.images.size).toBe(0);
    expect(repository.scans.get(scan.id)?.imagePath).toBeNull();
  });

  it("deletes a direct upload when its byte size does not match the reservation", async () => {
    const repository = new MemoryScanRepository();
    const images = new MemoryImageStore();
    const service = new PersistentScanService(repository, images);
    const scan = await service.createUploadSession("owner-a", crypto.randomUUID(), {
      mimeType: "image/png",
      byteSize: 3,
      provider: "mock"
    });

    await images.put(scan.imagePath!, new Uint8Array([1, 2]));
    await expect(
      service.submitScan("owner-a", scan.id, new MockSkinAnalysisProvider())
    ).resolves.toMatchObject({
      scanId: scan.id,
      status: "upload_failed",
      error: { code: "UPLOAD_MISMATCH" }
    });
    expect(images.images.size).toBe(0);
  });

  it("persists an idempotent owner-scoped scan and removes the original by default", async () => {
    const repository = new MemoryScanRepository();
    const images = new MemoryImageStore();
    const service = new PersistentScanService(repository, images);
    const requestId = crypto.randomUUID();
    const first = await service.createUploadSession("owner-a", requestId, {
      mimeType: "image/jpeg",
      byteSize: 3,
      provider: "mock"
    });
    const repeated = await service.createUploadSession("owner-a", requestId, {
      mimeType: "image/jpeg",
      byteSize: 3,
      provider: "mock"
    });
    const otherOwner = await service.createUploadSession("owner-b", requestId, {
      mimeType: "image/jpeg",
      byteSize: 3,
      provider: "mock"
    });

    expect(repeated.id).toBe(first.id);
    expect(otherOwner.id).not.toBe(first.id);
    await expect(service.getScan("owner-b", first.id)).resolves.toBeNull();
    await expect(
      service.storeScanImage("owner-a", first.id, new Uint8Array([1, 2]), "image/jpeg")
    ).resolves.toBe("mismatch");
    await expect(
      service.storeScanImage("owner-a", first.id, new Uint8Array([1, 2, 3]), "image/jpeg")
    ).resolves.toBe("stored");

    const submitted = await service.submitScan(
      "owner-a",
      first.id,
      new MockSkinAnalysisProvider()
    );
    expect(submitted).toMatchObject({ scanId: first.id, status: "processing" });
    expect(submitted?.activity?.[0]).toMatchObject({
      source: "mock",
      message: "deterministic test task created"
    });
    expect(images.images.size).toBe(1);
    expect(repository.scans.get(first.id)?.imagePath).not.toBeNull();

    const completed = await service.getScan(
      "owner-a",
      first.id,
      new MockSkinAnalysisProvider()
    );
    expect(completed).toMatchObject({
      scanId: first.id,
      status: "normalized",
      result: { id: first.id, provider: "mock" }
    });
    expect(completed?.activity?.map((event) => event.message)).toContain(
      "7 scores and 0 masks persisted"
    );
    expect(images.images.size).toBe(0);
    expect(repository.scans.get(first.id)?.imagePath).toBeNull();
    expect(repository.concerns.get(first.id)?.length).toBeGreaterThan(0);
  });

  it("keeps an opted-in original until the owner deletes it", async () => {
    const repository = new MemoryScanRepository();
    const images = new MemoryImageStore();
    const service = new PersistentScanService(repository, images);
    const scan = await service.createUploadSession("owner-a", crypto.randomUUID(), {
      mimeType: "image/png",
      byteSize: 3,
      provider: "mock",
      retainImage: true
    });
    await service.storeScanImage("owner-a", scan.id, new Uint8Array([1, 2, 3]), "image/png");
    await service.submitScan("owner-a", scan.id, new MockSkinAnalysisProvider());

    expect(images.images.size).toBe(1);
    await expect(service.deleteImage("owner-b", scan.id)).resolves.toBeNull();
    await expect(service.deleteImage("owner-a", scan.id)).resolves.toMatchObject({
      imageDeleted: true,
      derivedScoresRetained: true
    });
    expect(images.images.size).toBe(0);
  });
});
