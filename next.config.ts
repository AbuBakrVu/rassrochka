import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Сборка со своим минимальным node_modules: в образ едет ~150 МБ вместо
  // нескольких сотен. Обязательно для Dockerfile (см. DEPLOY.md).
  output: "standalone",

  // Нативные модули нельзя бандлить — оставляем их обычными зависимостями
  serverExternalPackages: ["pg", "@node-rs/argon2"],

  // APP_DOMAIN не публичный секрет (это просто ваш домен), но lib/tenant-host.ts
  // читает его и в клиентских компонентах (/company, /admin — показать
  // адрес поддомена). Без явного проброса через `env` Next заменяет любую
  // process.env.* без префикса NEXT_PUBLIC_ на undefined в браузерном бандле.
  env: {
    APP_DOMAIN: process.env.APP_DOMAIN,
  },
};

export default nextConfig;
