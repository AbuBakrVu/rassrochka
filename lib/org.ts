import "server-only";

// Устройство компании: филиалы и свои роли. Сотрудники — в lib/queries.ts
// (createEmployee/updateEmployee), здесь только справочники, к которым они
// привязываются.

import { query, queryOne } from "./db";
import { isPermission, type Permission } from "./permissions";

export class OrgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgError";
  }
}

const UNIQUE_VIOLATION = "23505";

// ── Филиалы ────────────────────────────────────────────────────────────

export async function createBranch(dbName: string, input: { name: string; address?: string }): Promise<number> {
  try {
    const row = await queryOne<{ id: number }>(
      dbName,
      "insert into branches (name, address) values ($1, $2) returning id",
      [input.name, input.address || null]
    );
    return row!.id;
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new OrgError("Филиал с таким названием уже есть");
    throw err;
  }
}

/**
 * Правка филиала. Закрыть можно любой, кроме последнего работающего: в
 * закрытый нельзя оформить новую сделку, но его клиенты, сделки и касса
 * остаются и видны в «Все филиалы».
 */
export async function updateBranch(
  dbName: string,
  id: number,
  input: { name: string; address?: string; active: boolean }
): Promise<void> {
  if (!input.active) {
    const rows = await query<{ id: number }>(dbName, "select id from branches where active and id <> $1", [id]);
    if (rows.length === 0) throw new OrgError("Это последний работающий филиал");
  }
  try {
    const row = await queryOne<{ id: number }>(
      dbName,
      "update branches set name = $2, address = $3, active = $4 where id = $1 returning id",
      [id, input.name, input.address || null, input.active]
    );
    if (!row) throw new OrgError("Филиал не найден");
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new OrgError("Филиал с таким названием уже есть");
    throw err;
  }
}

// ── Свои роли ──────────────────────────────────────────────────────────

function cleanPermissions(list: readonly string[]): Permission[] {
  const set = new Set(list.filter(isPermission));
  // Действие без раздела бессмысленно: оформлять сделки, не видя сделок, нельзя
  if (set.has("deals.edit") || set.has("payments.accept")) set.add("deals");
  if (set.has("clients.edit") || set.has("clients.personal")) set.add("clients");
  if (set.has("cash.edit")) set.add("cash");
  return [...set];
}

export async function createRole(dbName: string, input: { name: string; permissions: string[] }): Promise<number> {
  try {
    const row = await queryOne<{ id: number }>(
      dbName,
      "insert into roles (name, permissions) values ($1, $2) returning id",
      [input.name, cleanPermissions(input.permissions)]
    );
    return row!.id;
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new OrgError("Роль с таким названием уже есть");
    throw err;
  }
}

/** Права меняются у всех сотрудников роли сразу — со следующего запроса. */
export async function updateRole(
  dbName: string,
  id: number,
  input: { name: string; permissions: string[] }
): Promise<void> {
  try {
    const row = await queryOne<{ id: number }>(
      dbName,
      "update roles set name = $2, permissions = $3 where id = $1 returning id",
      [id, input.name, cleanPermissions(input.permissions)]
    );
    if (!row) throw new OrgError("Роль не найдена");
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new OrgError("Роль с таким названием уже есть");
    throw err;
  }
}

export async function deleteRole(dbName: string, id: number): Promise<string> {
  const users = await query<{ name: string }>(dbName, "select name from users where role_id = $1", [id]);
  if (users.length > 0) {
    throw new OrgError(`Роль назначена сотрудникам: ${users.map((u) => u.name).join(", ")} — сначала смените им роль`);
  }
  const row = await queryOne<{ name: string }>(dbName, "delete from roles where id = $1 returning name", [id]);
  if (!row) throw new OrgError("Роль не найдена");
  return row.name;
}

export async function roleName(dbName: string, id: number): Promise<string | undefined> {
  return (await queryOne<{ name: string }>(dbName, "select name from roles where id = $1", [id]))?.name;
}

export async function branchName(dbName: string, id: number | null): Promise<string> {
  if (id === null) return "все филиалы";
  return (await queryOne<{ name: string }>(dbName, "select name from branches where id = $1", [id]))?.name ?? `филиал ${id}`;
}
