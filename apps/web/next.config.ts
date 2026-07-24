import type { NextConfig } from "next";

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
