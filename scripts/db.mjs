// Общие помощники для скриптов работы с БД.
//
// Намеренно .mjs, а не .ts: эти скрипты запускаются внутри production-
// контейнера (`node scripts/migrate-all.mjs` после выката), где нет ни
// tsx, ни исходников TypeScript — в standalone-сборку Next.js они не
// попадают. Обычный JS работает на любой версии Node без оговорок.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(here, "..", "db", "migrations");

// Базовый URL без имени базы: postgres://user:pass@host:5432
export const PG_BASE_URL = (
  process.env.PG_BASE_URL ?? "postgres://localhost:5432"
).replace(/\/+$/, "");

export const CONTROL_DB = process.env.CONTROL_DB ?? "finora_control";

// Служебная база для CREATE/DROP DATABASE: нельзя создать базу, будучи
// подключённым к ней самой, нужна любая посторонняя.
const MAINTENANCE_DB = process.env.PG_MAINTENANCE_DB ?? "postgres";

export function dbNameForSlug(slug) {
  return `finora_${slug.replace(/-/g, "_")}`;
}

// Открывает соединение, выполняет fn, гарантированно закрывает.
export async function withDb(dbName, fn) {
  const client = new Client({ connectionString: `${PG_BASE_URL}/${dbName}` });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export function withMaintenanceDb(fn) {
  return withDb(MAINTENANCE_DB, fn);
}

export async function databaseExists(client, dbName) {
  const { rows } = await client.query(
    "select 1 from pg_database where datname = $1",
    [dbName]
  );
  return rows.length > 0;
}

// CREATE DATABASE не работает внутри транзакции и не принимает параметры,
// поэтому имя подставляем через quote_ident на стороне сервера.
export async function createDatabase(client, dbName) {
  const { rows } = await client.query("select quote_ident($1) as ident", [
    dbName,
  ]);
  await client.query(`create database ${rows[0].ident}`);
}

export async function dropDatabase(client, dbName) {
  const { rows } = await client.query("select quote_ident($1) as ident", [
    dbName,
  ]);
  await client.query(`drop database if exists ${rows[0].ident}`);
}

// Накатывает недостающие миграции из каталога. Каждая — в своей
// транзакции: упавшая не оставляет половину схемы, а уже применённые
// не откатываются.
export async function applyMigrations(client, dir, label) {
  await client.query(`
    create table if not exists schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("select version from schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");

    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (version) values ($1)",
        [file]
      );
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw new Error(`${label}: миграция ${file} не применилась — ${err.message}`);
    }
    console.log(`  ✓ ${label}: ${file}`);
    count += 1;
  }
  return count;
}

// Создаёт control-базу, если её ещё нет, и накатывает её миграции.
export async function ensureControlDb() {
  const created = await withMaintenanceDb(async (client) => {
    if (await databaseExists(client, CONTROL_DB)) return false;
    await createDatabase(client, CONTROL_DB);
    return true;
  });

  if (created) console.log(`  ✓ создана база реестра ${CONTROL_DB}`);

  await withDb(CONTROL_DB, (client) =>
    applyMigrations(client, path.join(MIGRATIONS_DIR, "control"), CONTROL_DB)
  );

  return created;
}

export function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// Разбор аргументов вида --slug acme --name "ООО Акме"
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}
