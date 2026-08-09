# Сборка идёт на сервере из git (см. DEPLOY.md), реестр образов не нужен.

# ── Зависимости ────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci внутри образа, а не копирование node_modules с машины разработчика:
# у @node-rs/argon2 нативные бинарники, и здесь ставится сборка под musl
RUN npm ci

# ── Сборка ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Запуск ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

# output: "standalone" кладёт в .next/standalone минимальный node_modules —
# только то, что реально импортируется. Отсюда же скрипты берут pg.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Миграции и скрипты управления компаниями: Next их не трассирует, потому
# что из приложения они не импортируются, — копируем отдельно
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
