import "server-only";

// Простой in-memory rate limiter для роутов входа. Процесс приложения —
// один инстанс (docker-compose, без горизонтального масштабирования),
// поэтому общей памяти достаточно, Redis не нужен.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const hits = new Map<string, { count: number; resetAt: number }>();

// Не даём Map расти бесконечно при большом потоке разных IP
function sweep(now: number) {
  if (hits.size < 5000) return;
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
}

/** true — можно пробовать войти, false — превышен лимит попыток. */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  sweep(now);

  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
