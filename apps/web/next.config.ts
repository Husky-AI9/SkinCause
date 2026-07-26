import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { resolve } from "node:path";

loadEnvConfig(
  resolve(__dirname, "../.."),
  process.env.NODE_ENV !== "production",
  undefined,
  true
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  },
  transpilePackages: [
    "@skincause/api-client",
    "@skincause/association-engine",
    "@skincause/contracts",
    "@skincause/design-tokens",
    "@skincause/domain",
    "@skincause/server-core"
  ]
};

export default nextConfig;
