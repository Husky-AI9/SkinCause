import type { ApiFailure, ApiSuccess, LocalImageAsset, Product } from "@skincause/contracts";

export class SkinCauseApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getAccessToken();
    const response = await fetchImpl(`${options.baseUrl}${path}`, {
      ...init,
      signal: init.signal,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });
    const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
    if (!response.ok || "error" in payload) {
      const error = "error" in payload ? payload.error : { code: "UNKNOWN", message: "Request failed.", retryable: false };
      throw new SkinCauseApiError(error.message, error.code, error.retryable);
    }
    return payload.data;
  }

  return {
    getMe: (signal?: AbortSignal) => request<{ mode: string; capabilities: string[] }>("/me", { signal }),
    listProducts: (signal?: AbortSignal) => request<Product[]>("/products", { signal }),
    createProduct: (input: Omit<Product, "id">, signal?: AbortSignal) =>
      request<Product>("/products", { method: "POST", body: JSON.stringify(input), signal }),
    listExperiments: (signal?: AbortSignal) => request<unknown[]>("/experiments", { signal }),
    getExperiment: (id: string, signal?: AbortSignal) => request<unknown>(`/experiments/${id}`, { signal }),
    createUploadSession: (asset: LocalImageAsset, clientRequestId: string, signal?: AbortSignal) =>
      request<{ scanId: string; uploadUrl: string; method: "PUT"; expiresAt: string }>("/scans/upload-sessions", {
        method: "POST",
        body: JSON.stringify({ ...asset, clientRequestId }),
        signal
      }),
    submitScan: (id: string, clientRequestId: string, signal?: AbortSignal) =>
      request<unknown>(`/scans/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ clientRequestId }),
        signal
      }),
    getScan: (id: string, signal?: AbortSignal) => request<unknown>(`/scans/${id}`, { signal })
  };
}
