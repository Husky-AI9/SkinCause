"use client";

import type { Product } from "@skincause/contracts";
import { products as seededProducts } from "@skincause/domain";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "../lib/supabase-browser";

type AppState = {
  consented: boolean;
  retainImages: boolean;
  products: Product[];
  deletedImageIds: string[];
  checkInSaved: boolean;
};

type AppContextValue = AppState & {
  authStatus: "loading" | "guest" | "demo" | "authenticated";
  demoMode: boolean;
  userEmail: string | null;
  setConsented(value: boolean): void;
  setRetainImages(value: boolean): void;
  addProduct(product: Omit<Product, "id">): Promise<Product>;
  toggleProduct(id: string): Promise<Product | null>;
  deleteImage(id: string): void;
  saveCheckIn(): void;
  reset(): void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
  signOut(): Promise<void>;
  enterDemo(): Promise<void>;
  exitDemo(): Promise<void>;
  apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

const initialState: AppState = {
  consented: false,
  retainImages: false,
  products: seededProducts,
  deletedImageIds: [],
  checkInSaved: false
};

const AppContext = createContext<AppContextValue | null>(null);
const storageKey = "skincause-guest-v1";
const demoStorageKey = "skincause-demo-active";

async function readApiData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "The request could not be completed.");
  }
  return payload.data;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [authStatus, setAuthStatus] = useState<AppContextValue["authStatus"]>(
    isSupabaseBrowserConfigured() ? "loading" : "guest"
  );
  const [demoMode, setDemoMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const savedDemoMode = window.localStorage.getItem(demoStorageKey) === "true";
    const timer = window.setTimeout(() => {
      if (saved) {
        try {
          setState({ ...initialState, ...(JSON.parse(saved) as Partial<AppState>) });
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
      setDemoMode(savedDemoMode);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    if (demoMode) {
      window.localStorage.setItem(demoStorageKey, "true");
    } else {
      window.localStorage.removeItem(demoStorageKey);
    }
  }, [demoMode, hydrated]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    let active = true;
    const loadProducts = async (accessToken: string) => {
      const products = await readApiData<Product[]>(
        await fetch("/api/v1/products", {
          headers: { authorization: `Bearer ${accessToken}` },
          cache: "no-store"
        })
      );
      if (active) setState((current) => ({ ...current, products }));
    };

    const applySession = (session: Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"]) => {
      if (!active) return;
      const isAnonymous = session?.user.is_anonymous === true;
      setAuthStatus(session ? isAnonymous ? "demo" : "authenticated" : "guest");
      setUserEmail(isAnonymous ? null : session?.user.email ?? null);
      if (isAnonymous) {
        setDemoMode(true);
      } else if (session) {
        setDemoMode(false);
        void loadProducts(session.access_token);
      } else {
        setDemoMode(false);
      }
    };

    void client.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      applySession(session);
      if (!session && event === "SIGNED_OUT") {
        setState((current) => ({ ...current, products: seededProducts }));
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("Supabase authentication is not configured.");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("Supabase authentication is not configured.");
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { confirmationRequired: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const enterDemo = useCallback(async () => {
    window.localStorage.removeItem("skincause-active-scan");
    window.localStorage.removeItem("skincause-latest-scan");
    window.localStorage.removeItem("skincause-active-experiment");
    setState({ ...initialState, consented: true });
    const client = getSupabaseBrowserClient();
    if (!client) {
      setAuthStatus("guest");
      setDemoMode(true);
      return;
    }
    if (process.env.NEXT_PUBLIC_SUPABASE_ANONYMOUS_ENABLED !== "true") {
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        setAuthStatus("guest");
        setDemoMode(true);
        return;
      }
      throw new Error("The demo workspace is not configured.");
    }

    const { data: current } = await client.auth.getSession();
    if (current.session && current.session.user.is_anonymous !== true) {
      setAuthStatus("authenticated");
      setDemoMode(false);
      return;
    }
    if (current.session?.user.is_anonymous === true) {
      setAuthStatus("demo");
      setDemoMode(true);
      return;
    }

    const { error } = await client.auth.signInAnonymously({
      options: { data: { display_name: "Demo investigator" } }
    });
    if (error) {
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        setAuthStatus("guest");
        setDemoMode(true);
        return;
      }
      throw new Error("The demo workspace is temporarily unavailable.");
    }
    setAuthStatus("demo");
    setDemoMode(true);
  }, []);

  const exitDemo = useCallback(async () => {
    window.localStorage.removeItem("skincause-active-scan");
    window.localStorage.removeItem("skincause-latest-scan");
    window.localStorage.removeItem("skincause-active-experiment");
    const client = getSupabaseBrowserClient();
    if (client) {
      const { data } = await client.auth.getSession();
      if (data.session?.user.is_anonymous === true) {
        const deletion = await fetch("/api/v1/account", {
          method: "DELETE",
          headers: { authorization: `Bearer ${data.session.access_token}` }
        });
        if (!deletion.ok) throw new Error("The temporary demo data could not be deleted.");
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw new Error(error.message);
      }
    }
    setAuthStatus("guest");
    setDemoMode(false);
    setState(initialState);
  }, []);

  const apiFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const client = getSupabaseBrowserClient();
    const headers = new Headers(init?.headers);
    if (client) {
      const { data } = await client.auth.getSession();
      if (data.session?.access_token) {
        headers.set("authorization", `Bearer ${data.session.access_token}`);
      }
    }
    return fetch(input, { ...init, headers });
  }, []);

  const addProduct = useCallback(async (product: Omit<Product, "id">) => {
    if (authStatus === "authenticated") {
      const created = await readApiData<Product>(
        await apiFetch("/api/v1/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(product)
        })
      );
      setState((current) => ({ ...current, products: [...current.products, created] }));
      return created;
    }
    const created = { ...product, id: crypto.randomUUID() };
    setState((current) => ({ ...current, products: [...current.products, created] }));
    return created;
  }, [apiFetch, authStatus]);

  const toggleProduct = useCallback(async (id: string) => {
    const currentProduct = state.products.find((product) => product.id === id);
    if (!currentProduct) return null;
    if (authStatus === "authenticated") {
      const updated = await readApiData<Product & { historyAppended?: boolean }>(
        await apiFetch(`/api/v1/products/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: !currentProduct.active })
        })
      );
      setState((current) => ({
        ...current,
        products: current.products.map((product) => product.id === id ? updated : product)
      }));
      return updated;
    }
    const updated = { ...currentProduct, active: !currentProduct.active };
    setState((current) => ({
      ...current,
      products: current.products.map((product) => product.id === id ? updated : product)
    }));
    return updated;
  }, [apiFetch, authStatus, state.products]);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      authStatus,
      demoMode,
      userEmail,
      setConsented: (consented) => setState((current) => ({ ...current, consented })),
      setRetainImages: (retainImages) => setState((current) => ({ ...current, retainImages })),
      addProduct,
      toggleProduct,
      deleteImage: (id) =>
        setState((current) => ({
          ...current,
          deletedImageIds: [...new Set([...current.deletedImageIds, id])]
        })),
      saveCheckIn: () => setState((current) => ({ ...current, checkInSaved: true })),
      reset: () => setState(initialState),
      signIn,
      signUp,
      signOut,
      enterDemo,
      exitDemo,
      apiFetch
    }),
    [
      addProduct,
      apiFetch,
      authStatus,
      demoMode,
      enterDemo,
      exitDemo,
      signIn,
      signOut,
      signUp,
      state,
      toggleProduct,
      userEmail
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used within AppProvider");
  return context;
}
