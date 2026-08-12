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

  // HSTS полагается на Caddy (уже отдаёт только https), остальное —
  // на уровне приложения, чтобы работать и без Caddy (например при
  // прямом доступе к контейнеру в разработке).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
