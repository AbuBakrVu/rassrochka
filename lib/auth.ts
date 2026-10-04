import "server-only";

// Авторизация: пароли argon2id, сессии строками в таблице sessions компании.
//
// Своя реализация вместо Auth.js осознанно: у каждой компании отдельная база
// (см. MIGRATION.md §2), и адаптеры готовых библиотек с этим не дружат —
// они рассчитывают на одно подключение. Здесь всего ~100 строк.

import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { query, queryOne, transaction } from "./db";
import { permissionsFor, type Permission, type RoleKind } from "./permissions";

export { SESSION_COOKIE } from "./auth-shared";

const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  initials: string;
  role: RoleKind;
  /** Своя роль — её название; у встроенных пусто. */
  roleName?: string;
  permissions: Permission[];
  /** Филиал сотрудника; null — видит все филиалы. */
  branchId: number | null;
  mustChangePassword: boolean;
}

export class UnauthorizedError extends Error {
  constructor(message = "Требуется вход") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Недостаточно прав") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const hashPassword = (password: string) => hash(password);

/** Случайный временный пароль для нового сотрудника. */
export const generatePassword = () => randomBytes(9).toString("base64url");

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

interface UserRow extends Record<string, unknown> {
  id: number;
  email: string;
  name: string;
  initials: string;
  role: RoleKind;
  password_hash: string;
  must_change_password: boolean;
  branch_id: number | null;
  role_name: string | null;
  role_permissions: string[] | null;
}

const toSessionUser = (row: UserRow): SessionUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  initials: row.initials,
  role: row.role,
  ...(row.role === "custom" && row.role_name ? { roleName: row.role_name } : {}),
  permissions: permissionsFor(row.role, row.role_permissions),
  // Администратор всегда видит всю компанию
  branchId: row.role === "admin" ? null : row.branch_id,
  mustChangePassword: row.must_change_password,
});

const USER_COLUMNS = `u.id, u.email, u.name, u.initials, u.role, u.password_hash,
  u.must_change_password, u.branch_id, r.name as role_name, r.permissions as role_permissions`;

/**
 * Проверяет пару почта/пароль. Возвращает undefined и при неизвестной почте,
 * и при неверном пароле — по ответу нельзя понять, какие адреса заведены.
 */
export async function verifyCredentials(
  dbName: string,
  email: string,
  password: string
): Promise<SessionUser | undefined> {
  const row = await queryOne<UserRow>(
    dbName,
    `select ${USER_COLUMNS}
     from users u left join roles r on r.id = u.role_id
     where u.email = $1 and u.active`,
    [email]
  );

  // Хешируем даже когда пользователя нет: иначе по времени ответа можно
  // перебрать существующие адреса (мгновенный отказ = нет такого)
  const target = row?.password_hash ?? DUMMY_HASH;
  const ok = await verify(target, password).catch(() => false);

  return row && ok ? toSessionUser(row) : undefined;
}

// Хеш от случайной 32-байтовой строки, которую никто не знает. Нужен только
// для выравнивания времени ответа, поэтому параметры должны совпадать с
// боевыми — иначе проверка отработает быстрее и разница снова станет заметна.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$Pho6VazIqoozYhHObiUtKw$a5K1cePzx6dYT9yZIVwcchd92vQ0IxLujXYHfi4Tzb8";

export async function createSession(
  dbName: string,
  userId: number
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await transaction(dbName, async (client) => {
    // Подчищаем протухшие заодно — отдельная задача по расписанию не нужна
    await client.query("delete from sessions where expires_at < now()");
    await client.query(
      "insert into sessions (token, user_id, expires_at) values ($1, $2, $3)",
      [token, userId, expiresAt]
    );
  });

  return { token, expiresAt };
}

export async function findSessionUser(
  dbName: string,
  token: string | undefined
): Promise<SessionUser | undefined> {
  if (!token) return undefined;

  const row = await queryOne<UserRow>(
    dbName,
    `select ${USER_COLUMNS}
     from sessions s join users u on u.id = s.user_id
     left join roles r on r.id = u.role_id
     where s.token = $1 and s.expires_at > now() and u.active`,
    [token]
  );

  return row ? toSessionUser(row) : undefined;
}

export async function deleteSession(dbName: string, token: string | undefined) {
  if (!token) return;
  await query(dbName, "delete from sessions where token = $1", [token]);
}

export async function changePassword(
  dbName: string,
  userId: number,
  newPassword: string,
  keepToken: string | undefined
) {
  const passwordHash = await hashPassword(newPassword);
  await transaction(dbName, async (client) => {
    await client.query(
      `update users set password_hash = $2, must_change_password = false
       where id = $1`,
      [userId, passwordHash]
    );
    // Смена пароля выкидывает все прочие сессии: если пароль меняют из-за
    // того, что его подсмотрели, чужой вход должен оборваться
    await client.query(
      "delete from sessions where user_id = $1 and token is distinct from $2",
      [userId, keepToken ?? null]
    );
  });
}
