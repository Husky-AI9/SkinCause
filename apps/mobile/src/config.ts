const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

export const apiBaseUrl = configuredBaseUrl ?? "http://10.0.2.2:3000/api/v1";
export const apiOrigin = apiBaseUrl.replace(/\/api\/v1$/, "");

export const supabaseConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
};
