import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dockerfile 的 runner stage 只複製 .next/standalone
  output: "standalone",
  // 部署時由 deploy.yml 提供，/api/health 回報線上跑的 commit；本機沒設就是空字串
  env: { APP_COMMIT_SHA: process.env.APP_COMMIT_SHA ?? "" },
};

export default nextConfig;
