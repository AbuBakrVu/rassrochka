import "server-only";

// Подключение к Postgres. У каждой компании своя база (см. MIGRATION.md §2),
// поэтому пул заводится на имя базы, а не один на приложение.

import { Pool, type PoolClient } from "pg";
import pg from "pg";

// ── Разбор типов Postgres ──────────────────────────────────────────────
// Оба парсера обязательны, иначе цифры и даты приезжают неправильными.

// numeric приходит строкой ("96000.00"), потому что не всякое значение
// numeric влезает в double. У нас суммы до миллионов — влезают.
pg.types.setTypeParser(1700, (v) => Number.parseFloat(v));

// date по умолчанию превращается в Date в часовом поясе сервера, из-за чего
// «2026-08-05» на машине восточнее UTC становится 4 августа. Нам нужна
// календарная дата без времени — оставляем строкой, как в схеме.
pg.types.setTypeParser(1082, (v) => v);

// bigint (bigserial) приезжает строкой, потому что не всякий int8 влезает в
// double. Из-за этого id пользователя был "1" вместо 1, и сравнения вида
// Number(id) === user.id молча возвращали false. Наши id — счётчики строк,
// до 2^53 им бесконечно далеко, поэтому разбираем их числом.
pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));

const PG_BASE_URL = (
  process.env.PG_BASE_URL ?? "postgres://localhost:5432"
).replace(/\/+$/, "");

export const CONTROL_DB = process.env.CONTROL_DB ?? "finora_control";

// В разработке hot-reload пересоздаёт модули, и пулы плодились бы при каждой
// правке файла, пока не упрутся в лимит соединений. Держим их на globalThis.
const globalForDb = globalThis as unknown as {
  __finoraPools?: Map<string, Pool>;
};
const pools = globalForDb.__finoraPools ?? new Map<string, Pool>();
if (process.env.NODE_ENV !== "production") globalForDb.__finoraPools = pools;

export function getPool(dbName: string): Pool {
  const existing = pools.get(dbName);
  if (existing) return existing;

  const pool = new Pool({
    connectionString: `${PG_BASE_URL}/${dbName}`,
    // НЕ по умолчанию (10): при 10 компаниях это 100 соединений, ровно
    // столько же, сколько max_connections у Postgres из коробки.
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Без этого обработчика ошибка простаивающего соединения (например,
  // Postgres перезапустили) роняет весь процесс Node.
  pool.on("error", (err) => {
    console.error(`[db:${dbName}] ошибка соединения: ${err.message}`);
  });

  pools.set(dbName, pool);
  return pool;
}

export async function query<T extends Record<string, unknown>>(
  dbName: string,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const { rows } = await getPool(dbName).query<T>(sql, params);
  return rows;
}

export async function queryOne<T extends Record<string, unknown>>(
  dbName: string,
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(dbName, sql, params);
  return rows[0];
}

// Транзакция с гарантированным возвратом соединения в пул. Нужна везде, где
// одно действие пишет в несколько таблиц: создание сделки трогает deals,
// cash_tx и deal_events, и половина от этого в базе недопустима.
export async function transaction<T>(
  dbName: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool(dbName).connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
