// Разбор Host → slug компании. Чистая функция без зависимостей: её
// импортируют и middleware (edge-рантайм), и серверный lib/tenant.ts.

/** Базовый домен установки: ваш домен в проде, localhost при разработке. */
export const APP_DOMAIN = (process.env.APP_DOMAIN ?? "localhost").toLowerCase();

export type HostKind =
  | { kind: "tenant"; slug: string }
  | { kind: "root" } // сам базовый домен — компания не выбрана
  | { kind: "unknown" }; // домен вообще не наш

// www — не компания, а тот же корень
const ROOT_ALIASES = new Set(["www"]);

export function parseHost(host: string | null): HostKind {
  if (!host) return { kind: "unknown" };

  // Отрезаем порт: acme.localhost:3000 → acme.localhost
  const clean = host.toLowerCase().split(":")[0].replace(/\.$/, "");

  if (clean === APP_DOMAIN) return { kind: "root" };
  if (!clean.endsWith(`.${APP_DOMAIN}`)) return { kind: "unknown" };

  const prefix = clean.slice(0, -(APP_DOMAIN.length + 1));

  // Многоуровневые поддомены (a.b.example.ru) не поддерживаем: slug — одна метка
  if (prefix === "" || prefix.includes(".")) return { kind: "unknown" };
  if (ROOT_ALIASES.has(prefix)) return { kind: "root" };

  return { kind: "tenant", slug: prefix };
}
