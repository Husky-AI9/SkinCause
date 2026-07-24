import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { resolve } from "node:path";

loadEnvConfig(resolve(process.cwd(), "../.."));

const nextConfig: NextConfig = {
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
