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
import { apiBaseUrl, apiOrigin } from "./config";
import { activeScanStorageKey, latestScanStorageKey, supabase } from "./supabase";

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
  apiBaseUrl: string;
  activeScanId: string | null;
  latestScan: Scan | null;
  imageHeaders: Record<string, string>;
  startDemo(): Promise<void>;
  exitDemo(): Promise<void>;
  uploadAndSubmit(asset: LocalImageAsset): Promise<ScanStatus>;
  getScan(id: string): Promise<ScanStatus>;
  saveLatestScan(scan: Scan): Promise<void>;
  listProducts(): Promise<Product[]>;
  updateProduct(id: string, input: ProductUpdate): Promise<Product>;
  listExperiments(): Promise<Experiment[]>;
  getRoutineRecommendation(id: string): Promise<RoutineRecommendation | null>;
  generateRoutineRecommendation(id: string): Promise<RoutineRecommendation>;
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

export function MobileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [latestScan, setLatestScan] = useState<Scan | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [savedScanId, savedLatestScan] = await Promise.all([
        SecureStore.getItemAsync(activeScanStorageKey),
        SecureStore.getItemAsync(latestScanStorageKey)
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
    setLatestScan(null);
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
  const listProducts = useCallback(() => api.listProducts(), [api]);
  const updateProduct = useCallback(
    (id: string, input: ProductUpdate) => api.updateProduct(id, input),
    [api]
  );
  const listExperiments = useCallback(() => api.listExperiments(), [api]);
  const getRoutineRecommendation = useCallback(
    (id: string) => api.getRoutineRecommendation(id),
    [api]
  );
  const generateRoutineRecommendation = useCallback(
    (id: string) => api.generateRoutineRecommendation(id),
    [api]
  );
  const getSkinSimulation = useCallback(
    (id: string) => api.getSkinSimulation(id),
    [api]
  );
  const startSkinSimulation = useCallback(
    (id: string) => api.startSkinSimulation(id),
    [api]
  );
  const deleteSkinSimulation = useCallback(async (id: string) => {
    await api.deleteSkinSimulation(id);
  }, [api]);

  const uploadAndSubmit = useCallback(async (asset: LocalImageAsset) => {
    const fileResponse = await fetch(asset.uri);
    if (!fileResponse.ok) throw new Error("The selected image could not be read.");
    const image = await fileResponse.arrayBuffer();
    if (image.byteLength === 0 || image.byteLength >= 10_000_000) {
      throw new Error("Choose a JPG or PNG image smaller than 10 MB.");
    }
    const requestId = Crypto.randomUUID();
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
  }, [accessToken, api, getScan]);

  const value = useMemo(() => ({
    ready,
    demoMode,
    apiBaseUrl,
    activeScanId,
    latestScan,
    imageHeaders: accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : ({} as Record<string, string>),
    startDemo,
    exitDemo,
    uploadAndSubmit,
    getScan,
    saveLatestScan,
    listProducts,
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
    listExperiments,
    listProducts,
    updateProduct,
    ready,
    saveLatestScan,
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
