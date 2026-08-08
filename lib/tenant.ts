import "server-only";

// Определение компании по запросу: поддомен → база данных.
//
// На этапе 2 компания берётся из переменной окружения DEV_TENANT_SLUG —
// разбор Host появится на этапе 5. Поиск в реестре уже настоящий, поэтому
// этап 5 изменит ровно одну функцию: slugFromHost().

import { CONTROL_DB, queryOne } from "./db";

export interface Tenant {
  slug: string;
  name: string;
  dbName: string;
}

export class TenantNotFoundError extends Error {
  constructor(slug: string) {
    super(`Компания «${slug}» не найдена или отключена`);
    this.name = "TenantNotFoundError";
  }
}

interface CompanyRow extends Record<string, unknown> {
  slug: string;
  name: string;
  db_name: string;
}

// Реестр меняется редко, а запрос идёт на каждый вызов API. Держим короткий
// кеш: отключённая компания перестанет пускать максимум через минуту, но
// каждый запрос не ходит лишний раз в базу.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { tenant: Tenant; at: number }>();

export async function findTenant(slug: string): Promise<Tenant> {
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.tenant;

  const row = await queryOne<CompanyRow>(
    CONTROL_DB,
    "select slug, name, db_name from companies where slug = $1 and active",
    [slug]
  );

  if (!row) {
    cache.delete(slug);
    throw new TenantNotFoundError(slug);
  }

  const tenant: Tenant = { slug: row.slug, name: row.name, dbName: row.db_name };
  cache.set(slug, { tenant, at: Date.now() });
  return tenant;
}

// ЭТАП 5 заменит тело этой функции на разбор Host:
//   acme.finora.ru → "acme", finora.ru → null (лендинг)
function slugFromHost(_host: string | null): string | null {
  return process.env.DEV_TENANT_SLUG ?? null;
}

export async function resolveTenant(host: string | null): Promise<Tenant> {
  const slug = slugFromHost(host);
  if (!slug) {
    throw new TenantNotFoundError(
      "не определена (задайте DEV_TENANT_SLUG в .env.local)"
    );
  }
  return findTenant(slug);
}
