import "server-only";

// Накатывает SQL-миграции на базу компании из рантайма приложения.
//
// Логика идентична scripts/db.mjs::applyMigrations, но переписана отдельно:
// scripts/*.mjs — plain JS, запускаются вне сборки Next (`node scripts/...`
// в контейнере) и не могут быть импортированы отсюда. Дублирование
// осознанное — при правке одной версии проверить и вторую (обе покрыты
// одинаковыми тестами при создании компании через панель и через CLI).

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db";

// В контейнере (Dockerfile) db/ лежит рядом с server.js: WORKDIR /app,
// COPY db ./db. В разработке — рядом с package.json. Оба случая — это
// process.cwd() при штатном запуске (next start / node server.js).
const TENANT_MIGRATIONS_DIR = path.join(
  process.cwd(),
  "db",
  "migrations",
  "tenant"
);

export async function applyTenantMigrations(dbName: string): Promise<void> {
  const pool = getPool(dbName);

  await pool.query(`
    create table if not exists schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(TENANT_MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const { rows } = await pool.query<{ version: string }>(
    "select version from schema_migrations"
  );
  const applied = new Set(rows.map((r) => r.version));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(TENANT_MIGRATIONS_DIR, file), "utf8");

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (version) values ($1)",
        [file]
      );
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw new Error(
        `Миграция ${file} не применилась к ${dbName}: ${
          err instanceof Error ? err.message : err
        }`
      );
    } finally {
      client.release();
    }
  }
}
