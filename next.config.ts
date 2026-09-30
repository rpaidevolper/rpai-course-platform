import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dockerfile 的 runner stage 只複製 .next/standalone
  output: "standalone",
};

export default nextConfig;
