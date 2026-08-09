import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Сборка со своим минимальным node_modules: в образ едет ~150 МБ вместо
  // нескольких сотен. Обязательно для Dockerfile (см. DEPLOY.md).
  output: "standalone",

  // Нативные модули нельзя бандлить — оставляем их обычными зависимостями
  serverExternalPackages: ["pg", "@node-rs/argon2"],
};

export default nextConfig;
