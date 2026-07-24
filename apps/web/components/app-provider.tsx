"use client";

import type { Product } from "@skincause/contracts";
import { products as seededProducts } from "@skincause/domain";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AppState = {
  consented: boolean;
  retainImages: boolean;
  products: Product[];
  deletedImageIds: string[];
  checkInSaved: boolean;
};

type AppContextValue = AppState & {
  setConsented(value: boolean): void;
  setRetainImages(value: boolean): void;
  addProduct(product: Omit<Product, "id">): void;
  toggleProduct(id: string): void;
  deleteImage(id: string): void;
  saveCheckIn(): void;
  reset(): void;
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const timer = window.setTimeout(() => {
      if (saved) {
        try {
          setState({ ...initialState, ...(JSON.parse(saved) as Partial<AppState>) });
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, state]);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      setConsented: (consented) => setState((current) => ({ ...current, consented })),
      setRetainImages: (retainImages) => setState((current) => ({ ...current, retainImages })),
      addProduct: (product) =>
        setState((current) => ({
          ...current,
          products: [...current.products, { ...product, id: crypto.randomUUID() }]
        })),
      toggleProduct: (id) =>
        setState((current) => ({
          ...current,
          products: current.products.map((product) =>
            product.id === id ? { ...product, active: !product.active } : product
          )
        })),
      deleteImage: (id) =>
        setState((current) => ({
          ...current,
          deletedImageIds: [...new Set([...current.deletedImageIds, id])]
        })),
      saveCheckIn: () => setState((current) => ({ ...current, checkInSaved: true })),
      reset: () => setState(initialState)
    }),
    [state]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used within AppProvider");
  return context;
}
