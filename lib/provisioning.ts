import "server-only";

// Заведение и отключение компаний из приложения (панель владельца
// платформы, app/admin). Логика соответствует scripts/create-tenant.mjs —
// тот остаётся рабочим CLI-путём (аварийный доступ без веб-панели), этот
// модуль — основной путь через /admin. Правила валидации (RESERVED_SLUGS,
// SLUG_RE) держать одинаковыми в обоих местах при изменении.

import { generatePassword, hashPassword, initialsFrom } from "./auth";
import {
  CONTROL_DB,
  createDatabase,
  databaseExists,
  dropDatabase,
  query,
  queryOne,
  transaction,
} from "./db";
import { applyTenantMigrations } from "./migrate";
import { invalidateTenantCache } from "./tenant";

const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "static", "assets", "cdn", "mail", "smtp",
  "ftp", "ns", "ns1", "ns2", "root", "system", "internal", "status",
  "health", "help", "support", "blog", "docs", "login", "auth", "billing",
  "company",
]);

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export class ProvisioningError extends Error {}

function dbNameForSlug(slug: string): string {
  return `nasiya_${slug.replace(/-/g, "_")}`;
}

export interface CompanyRow {
  slug: string;
  name: string;
  dbName: string;
  active: boolean;
  createdAt: string;
}

export async function listCompanies(): Promise<CompanyRow[]> {
  const rows = await query<{
    slug: string;
    name: string;
    db_name: string;
    active: boolean;
    created_at: Date;
  }>(
    CONTROL_DB,
    "select slug, name, db_name, active, created_at from companies order by created_at desc"
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    dbName: r.db_name,
    active: r.active,
    createdAt: r.created_at.toISOString(),
  }));
}

export interface CompanyEmployee {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: "admin" | "manager";
  active: boolean;
  createdAt: string;
}

/**
 * Сотрудники одной компании — заходим напрямую в её базу по db_name из
 * реестра. Владелец платформы смотрит чужие компании только для контроля
 * (кто заведён, сколько сотрудников), но не управляет ими напрямую: роли
 * и приглашения — дело администратора самой компании в её /employees.
 */
export async function getCompanyEmployees(slug: string): Promise<CompanyEmployee[]> {
  const company = await queryOne<{ db_name: string }>(
    CONTROL_DB,
    "select db_name from companies where slug = $1",
    [slug]
  );
  if (!company) throw new ProvisioningError(`Компания «${slug}» не найдена`);

  const rows = await query<{
    id: number;
    name: string;
    initials: string;
    email: string;
    phone: string | null;
    role: "admin" | "manager";
    active: boolean;
    created_at: Date;
  }>(
    company.db_name,
    `select id, name, initials, email, phone, role, active, created_at
     from users order by active desc, name`
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    initials: r.initials,
    email: r.email,
    phone: r.phone ?? "—",
    role: r.role,
    active: r.active,
    createdAt: r.created_at.toISOString(),
  }));
}

export interface CreateCompanyInput {
  slug: string;
  name: string;
  adminEmail: string;
  adminName: string;
  cashOpening?: number;
}

export interface CreatedCompany {
  slug: string;
  adminEmail: string;
  /** Показывается вызывающему один раз — в базе лежит только хеш. */
  password: string;
}

/**
 * Полный цикл: проверки → CREATE DATABASE → миграции → администратор →
 * регистрация в реестре. При сбое после создания базы — откат (DROP
 * DATABASE), чтобы можно было повторить попытку с тем же slug.
 */
export async function createCompany(
  input: CreateCompanyInput
): Promise<CreatedCompany> {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();
  const adminEmail = input.adminEmail.trim();
  const adminName = input.adminName.trim() || "Администратор";
  const cashOpening = input.cashOpening ?? 0;

  if (!slug || !name || !adminEmail) {
    throw new ProvisioningError("Нужны slug, название и почта администратора");
  }
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 32) {
    throw new ProvisioningError(
      `Некорректный адрес «${slug}»: строчные латинские буквы, цифры и дефис (не по краям), 2–32 символа`
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new ProvisioningError(`Адрес «${slug}» зарезервирован под инфраструктуру`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    throw new ProvisioningError(`Некорректная почта администратора: «${adminEmail}»`);
  }
  if (!Number.isFinite(cashOpening) || cashOpening < 0) {
    throw new ProvisioningError("Некорректный остаток кассы");
  }

  const dbName = dbNameForSlug(slug);

  const existing = await queryOne<{ slug: string }>(
    CONTROL_DB,
    "select slug from companies where slug = $1 or db_name = $2",
    [slug, dbName]
  );
  if (existing) throw new ProvisioningError(`Компания «${slug}» уже существует`);

  if (await databaseExists(dbName)) {
    // Остаток от неудачной предыдущей попытки — не трогаем молча, это может
    // быть чужая база с совпавшим именем
    throw new ProvisioningError(
      `База ${dbName} уже существует без записи в реестре — требуется ручной разбор на сервере`
    );
  }

  await createDatabase(dbName);

  const password = generatePassword();

  try {
    await applyTenantMigrations(dbName);

    await transaction(dbName, async (client) => {
      const passwordHash = await hashPassword(password);
      await client.query(
        `insert into users (email, password_hash, name, initials, role,
                            must_change_password)
         values ($1, $2, $3, $4, 'admin', true)`,
        [adminEmail, passwordHash, adminName, initialsFrom(adminName)]
      );

      if (cashOpening > 0) {
        await client.query(
          "update settings set value = $1::jsonb where key = 'cash_opening_balance'",
          [String(cashOpening)]
        );
      }
    });

    // Регистрируем последним шагом: пока записи нет, компания не видна
    // resolveTenant() — недоделанная база никому не покажется
    await query(
      CONTROL_DB,
      "insert into companies (slug, name, db_name) values ($1, $2, $3)",
      [slug, name, dbName]
    );
  } catch (err) {
    await dropDatabase(dbName).catch(() => {});
    throw err instanceof ProvisioningError
      ? err
      : new ProvisioningError(
          `Не удалось создать компанию: ${err instanceof Error ? err.message : err}`
        );
  }

  return { slug, adminEmail, password };
}

export async function setCompanyActive(
  slug: string,
  active: boolean
): Promise<void> {
  const row = await queryOne<{ slug: string }>(
    CONTROL_DB,
    "update companies set active = $2 where slug = $1 returning slug",
    [slug, active]
  );
  if (!row) throw new ProvisioningError(`Компания «${slug}» не найдена`);

  // Без сброса кеша resolveTenant() продолжил бы пускать по старой записи
  // ещё до минуты (см. lib/tenant.ts CACHE_TTL_MS) — «Закрыть доступ»
  // обязан подействовать сразу же на следующий запрос
  invalidateTenantCache(slug);
}
