import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createApiClient, SkinCauseApiError } from "@skincause/api-client";
import type {
  Experiment,
  LocalImageAsset,
  Product,
  ProductUpdate,
  RoutineRecommendation,
  Scan,
  ScanUploadSession,
  SkinSimulation
} from "@skincause/contracts";
import {
  calculateSkinSimulationParameters,
  products as seededProducts,
  scans,
  seededExperiment,
  skinSimulationDisclaimer
} from "@skincause/domain";
import { apiBaseUrl, apiOrigin } from "./config";
import {
  activeScanStorageKey,
  latestRecommendationStorageKey,
  latestScanStorageKey,
  supabase
} from "./supabase";

const demoExperimentId = "brightening-serum-elimination";

type ScanStatus = {
  scanId: string;
  status: string;
  pollAfterMs?: number;
  result?: unknown;
  error?: { message?: string };
};

type MobileContextValue = {
  ready: boolean;
  demoMode: boolean;
  signedIn: boolean;
  apiBaseUrl: string;
  activeScanId: string | null;
  latestScan: Scan | null;
  latestRecommendation: RoutineRecommendation | null;
  imageHeaders: Record<string, string>;
  startDemo(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
  exitDemo(): Promise<void>;
  uploadAndSubmit(asset: LocalImageAsset): Promise<ScanStatus>;
  getScan(id: string): Promise<ScanStatus>;
  saveLatestScan(scan: Scan): Promise<void>;
  listProducts(): Promise<Product[]>;
  createProduct(input: Omit<Product, "id">): Promise<Product>;
  updateProduct(id: string, input: ProductUpdate): Promise<Product>;
  listExperiments(): Promise<Experiment[]>;
  getRoutineRecommendation(id: string): Promise<RoutineRecommendation | null>;
  generateRoutineRecommendation(id: string, maxUnitPriceUsd?: number): Promise<RoutineRecommendation>;
  getSkinSimulation(id: string): Promise<SkinSimulation | null>;
  startSkinSimulation(id: string): Promise<SkinSimulation>;
  deleteSkinSimulation(id: string): Promise<void>;
  clearActiveScan(): Promise<void>;
};

const MobileContext = createContext<MobileContextValue | null>(null);

function errorMessage(error: unknown) {
  if (error instanceof SkinCauseApiError) return error.message;
  return error instanceof Error ? error.message : "The request could not be completed.";
}

async function readApiData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { code?: string; message?: string; retryable?: boolean };
  };
  if (!response.ok || payload.data === undefined) {
    throw new SkinCauseApiError(
      payload.error?.message ?? "The request could not be completed.",
      payload.error?.code ?? "UNKNOWN",
      payload.error?.retryable ?? false
    );
  }
  return payload.data;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

const demoExperiment: Experiment = {
  id: seededExperiment.id,
  name: seededExperiment.name,
  type: seededExperiment.type,
  status: seededExperiment.status,
  startedAt: seededExperiment.startedAt,
  endedAt: seededExperiment.endedAt,
  suspectProductId: seededExperiment.suspectProductId,
  suspectProductName: seededExperiment.suspectProductName,
  hypothesis: seededExperiment.hypothesis,
  baselineScanId: seededExperiment.baselineScanId,
  analysisProfileVersion: seededExperiment.analysisProfileVersion,
  primaryConcerns: [...seededExperiment.primaryConcerns],
  checkIns: [],
  result: seededExperiment.result
};

export function MobileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [latestScan, setLatestScan] = useState<Scan | null>(null);
  const [latestRecommendation, setLatestRecommendation] = useState<RoutineRecommendation | null>(null);
  const [routine, setRoutine] = useState<Product[]>(seededProducts);
  const [demoSimulation, setDemoSimulation] = useState<SkinSimulation | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [savedScanId, savedLatestScan, savedRecommendation] = await Promise.all([
        SecureStore.getItemAsync(activeScanStorageKey),
        SecureStore.getItemAsync(latestScanStorageKey),
        SecureStore.getItemAsync(latestRecommendationStorageKey)
      ]);
      const sessionResult = supabase ? await supabase.auth.getSession() : null;
      if (!active) return;
      setActiveScanId(savedScanId);
      if (savedLatestScan) {
        try {
          setLatestScan(JSON.parse(savedLatestScan) as Scan);
        } catch {
          await SecureStore.deleteItemAsync(latestScanStorageKey);
        }
      }
      if (savedRecommendation) {
        try {
          setLatestRecommendation(JSON.parse(savedRecommendation) as RoutineRecommendation);
        } catch {
          await SecureStore.deleteItemAsync(latestRecommendationStorageKey);
        }
      }
      const session = sessionResult?.data.session ?? null;
      setAccessToken(session?.access_token ?? null);
      setDemoMode(session?.user.is_anonymous === true);
      setReady(true);
    })();
    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      setDemoMode(session?.user.is_anonymous === true);
    });
    return () => {
      active = false;
      listener?.data.subscription.unsubscribe();
    };
  }, []);

  const api = useMemo(() => createApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken: async () => accessToken
  }), [accessToken]);

  const startDemo = useCallback(async () => {
    await SecureStore.deleteItemAsync(latestScanStorageKey);
    setLatestScan(null);
    await SecureStore.deleteItemAsync(latestRecommendationStorageKey);
    setLatestRecommendation(null);
    setRoutine(seededProducts);
    setDemoSimulation(null);
    if (!supabase) {
      setDemoMode(true);
      return;
    }
    const { data: current, error: currentError } = await supabase.auth.getSession();
    if (currentError) throw new Error(currentError.message);
    if (current.session?.user.is_anonymous) {
      setDemoMode(true);
      return;
    }
    if (current.session) throw new Error("Sign out of the existing account before starting the disposable demo.");
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: "SkinCause Android demo" } }
    });
    if (error) throw new Error(error.message);
    setDemoMode(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Account access is not configured in this app build.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    setDemoMode(false);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Account access is not configured in this app build.");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    setDemoMode(false);
    return { confirmationRequired: !data.session };
  }, []);

  const clearActiveScan = useCallback(async () => {
    await SecureStore.deleteItemAsync(activeScanStorageKey);
    setActiveScanId(null);
  }, []);

  const saveLatestScan = useCallback(async (scan: Scan) => {
    await SecureStore.setItemAsync(latestScanStorageKey, JSON.stringify(scan));
    setLatestScan(scan);
  }, []);

  const exitDemo = useCallback(async () => {
    const token = accessToken;
    await clearActiveScan();
    await SecureStore.deleteItemAsync(latestScanStorageKey);
    await SecureStore.deleteItemAsync(latestRecommendationStorageKey);
    setLatestScan(null);
    setLatestRecommendation(null);
    setRoutine(seededProducts);
    setDemoSimulation(null);
    setDemoMode(false);
    setAccessToken(null);
    if (!supabase) return;
    try {
      if (token) {
        await fetch(`${apiBaseUrl}/account`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
      }
    } finally {
      await supabase.auth.signOut({ scope: "local" });
    }
  }, [accessToken, clearActiveScan]);

  const getScan = useCallback(async (id: string) => api.getScan(id) as Promise<ScanStatus>, [api]);
  const listProducts = useCallback(
    () => demoMode ? Promise.resolve(routine) : api.listProducts(),
    [api, demoMode, routine]
  );
  const createProduct = useCallback(async (input: Omit<Product, "id">) => {
    if (!demoMode) return api.createProduct(input);
    const created = { ...input, id: Crypto.randomUUID() };
    setRoutine((current) => [...current, created]);
    return created;
  }, [api, demoMode]);
  const updateProduct = useCallback(
    async (id: string, input: ProductUpdate) => {
      if (!demoMode) return api.updateProduct(id, input);
      const existing = routine.find((product) => product.id === id);
      if (!existing) throw new Error("The selected product was not found.");
      const updated = { ...existing, ...input };
      setRoutine((current) => current.map((product) => product.id === id ? updated : product));
      return updated;
    },
    [api, demoMode, routine]
  );
  const listExperiments = useCallback(
    () => demoMode ? Promise.resolve([demoExperiment]) : api.listExperiments(),
    [api, demoMode]
  );
  const getRoutineRecommendation = useCallback(
    (id: string) => demoMode && id === demoExperimentId
      ? Promise.resolve(latestRecommendation)
      : api.getRoutineRecommendation(id),
    [api, demoMode, latestRecommendation]
  );
  const generateRoutineRecommendation = useCallback(
    async (id: string, maxUnitPriceUsd = 25) => {
      const generated = await api.generateRoutineRecommendation(id, { maxUnitPriceUsd });
      if (demoMode && id === demoExperimentId) {
        await SecureStore.setItemAsync(latestRecommendationStorageKey, JSON.stringify(generated));
        setLatestRecommendation(generated);
      }
      return generated;
    },
    [api, demoMode]
  );
  const getSkinSimulation = useCallback(
    (id: string) => demoMode && id === demoExperimentId
      ? Promise.resolve(demoSimulation)
      : api.getSkinSimulation(id),
    [api, demoMode, demoSimulation]
  );
  const startSkinSimulation = useCallback(
    async (id: string) => {
      if (!demoMode || id !== demoExperimentId) return api.startSkinSimulation(id);
      const sourceResponse = await fetch(`${apiOrigin}/images/demo-face-acne.png`);
      if (!sourceResponse.ok) throw new Error("The demo source image could not be loaded.");
      const sourceImage = await sourceResponse.arrayBuffer();
      const response = await fetch(`${apiBaseUrl}/experiments/${encodeURIComponent(id)}/simulation`, {
        method: "POST",
        headers: {
          "content-type": "image/png",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
        },
        body: sourceImage
      });
      if (!response.ok) await readApiData(response);
      const mimeType = response.headers.get("content-type") ?? "image/png";
      const generatedImage = await response.arrayBuffer();
      const generatedAt = response.headers.get("x-skincause-generated-at") ?? new Date().toISOString();
      const simulation: SkinSimulation = {
        experimentId: id,
        status: "succeeded",
        provider: "youcam",
        sourceScanId: scans[0].id,
        targetScanId: scans.at(-1)!.id,
        parameters: calculateSkinSimulationParameters(scans[0], scans.at(-1)!),
        imageUrl: `data:${mimeType};base64,${arrayBufferToBase64(generatedImage)}`,
        generatedAt,
        expiresAt: response.headers.get("x-skincause-expires-at"),
        disclaimer: skinSimulationDisclaimer
      };
      setDemoSimulation(simulation);
      return simulation;
    },
    [accessToken, api, demoMode]
  );
  const deleteSkinSimulation = useCallback(async (id: string) => {
    if (demoMode && id === demoExperimentId) {
      setDemoSimulation(null);
      return;
    }
    await api.deleteSkinSimulation(id);
  }, [api, demoMode]);

  const uploadAndSubmit = useCallback(async (asset: LocalImageAsset) => {
    const fileResponse = await fetch(asset.uri);
    if (!fileResponse.ok) throw new Error("The selected image could not be read.");
    const image = await fileResponse.arrayBuffer();
    if (image.byteLength === 0 || image.byteLength >= 10_000_000) {
      throw new Error("Choose a JPG or PNG image smaller than 10 MB.");
    }
    const requestId = Crypto.randomUUID();
    if (demoMode && asset.fileName === "skincause-acne-demo.png") {
      const response = await fetch(`${apiBaseUrl}/scans/demo`, {
        method: "POST",
        headers: {
          "content-type": "image/png",
          "x-client-request-id": requestId,
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
        },
        body: image
      });
      return readApiData<ScanStatus>(response);
    }
    const input: LocalImageAsset = { ...asset, byteSize: image.byteLength };
    const session = await api.createUploadSession(input, requestId) as ScanUploadSession;
    await SecureStore.setItemAsync(activeScanStorageKey, session.scanId);
    setActiveScanId(session.scanId);

    if (session.upload.type === "supabase-signed") {
      if (!supabase) throw new Error("Supabase configuration is required to upload this scan.");
      const upload = await supabase.storage
        .from(session.upload.bucket)
        .uploadToSignedUrl(session.upload.path, session.upload.token, image, { contentType: asset.mimeType });
      if (upload.error) throw new Error(upload.error.message);
    } else {
      const url = session.upload.url.startsWith("http")
        ? session.upload.url
        : `${apiOrigin}${session.upload.url}`;
      const response = await fetch(url, {
        method: session.upload.method,
        headers: {
          ...session.upload.requiredHeaders,
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
        },
        body: image
      });
      if (!response.ok) throw new Error("The selected image could not be uploaded.");
    }
    await api.submitScan(session.scanId, requestId);
    return getScan(session.scanId);
  }, [accessToken, api, demoMode, getScan]);

  const value = useMemo(() => ({
    ready,
    demoMode,
    signedIn: Boolean(accessToken && !demoMode),
    apiBaseUrl,
    activeScanId,
    latestScan,
    latestRecommendation,
    imageHeaders: accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : ({} as Record<string, string>),
    startDemo,
    signIn,
    signUp,
    exitDemo,
    uploadAndSubmit,
    getScan,
    saveLatestScan,
    listProducts,
    createProduct,
    updateProduct,
    listExperiments,
    getRoutineRecommendation,
    generateRoutineRecommendation,
    getSkinSimulation,
    startSkinSimulation,
    deleteSkinSimulation,
    clearActiveScan
  }), [
    accessToken,
    activeScanId,
    clearActiveScan,
    deleteSkinSimulation,
    demoMode,
    exitDemo,
    generateRoutineRecommendation,
    getRoutineRecommendation,
    getScan,
    getSkinSimulation,
    latestScan,
    latestRecommendation,
    listExperiments,
    listProducts,
    createProduct,
    updateProduct,
    ready,
    saveLatestScan,
    signIn,
    signUp,
    startDemo,
    startSkinSimulation,
    uploadAndSubmit
  ]);

  return <MobileContext.Provider value={value}>{children}</MobileContext.Provider>;
}

export function useMobile() {
  const value = useContext(MobileContext);
  if (!value) throw new Error("useMobile must be used inside MobileProvider.");
  return value;
}

export { errorMessage };
