import { createApiClient } from "@skincause/api-client";
import type { LocalImageAsset } from "@skincause/contracts";
import { persistentDisclaimer } from "@skincause/domain";

export interface ImageCaptureAdapter {
  capture(): Promise<LocalImageAsset | null>;
  chooseFromLibrary(): Promise<LocalImageAsset | null>;
}

export interface SecureSessionStore {
  getAccessToken(): Promise<string | null>;
  setSession(input: { accessToken: string; refreshToken: string }): Promise<void>;
  clear(): Promise<void>;
}

export function createMobileServices(input: {
  baseUrl: string;
  sessionStore: SecureSessionStore;
  captureAdapter: ImageCaptureAdapter;
}) {
  return {
    api: createApiClient({
      baseUrl: input.baseUrl,
      getAccessToken: () => input.sessionStore.getAccessToken()
    }),
    capture: input.captureAdapter,
    disclaimer: persistentDisclaimer
  };
}
