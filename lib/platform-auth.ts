import "server-only";

// Авторизация владельца платформы. Зеркалит lib/auth.ts (пароли argon2id,
// сессии строками в таблице), но работает с platform_admins/
// platform_sessions в CONTROL_DB, а не с users/sessions компании —
// осознанно отдельный код, а не общий с параметром «какая таблица»:
// две модели ничего не должны знать друг о друге.

import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { CONTROL_DB, query, queryOne, transaction } from "./db";

export { PLATFORM_SESSION_COOKIE } from "./auth-shared";

const SESSION_DAYS = 30;

export interface PlatformAdmin {
  id: number;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

export class UnauthorizedError extends Error {
  constructor(message = "Требуется вход") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export const hashPassword = (password: string) => hash(password);
export const generatePassword = () => randomBytes(9).toString("base64url");

// Тот же приём, что в lib/auth.ts: хешируем даже когда админа с такой
// почтой нет, чтобы по времени ответа нельзя было перебрать адреса
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$Pho6VazIqoozYhHObiUtKw$a5K1cePzx6dYT9yZIVwcchd92vQ0IxLujXYHfi4Tzb8";

interface AdminRow extends Record<string, unknown> {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  must_change_password: boolean;
}

const toPlatformAdmin = (row: AdminRow): PlatformAdmin => ({
  id: row.id,
  email: row.email,
  name: row.name,
  mustChangePassword: row.must_change_password,
});

export async function verifyPlatformCredentials(
  email: string,
  password: string
): Promise<PlatformAdmin | undefined> {
  const row = await queryOne<AdminRow>(
    CONTROL_DB,
    `select id, email, name, password_hash, must_change_password
     from platform_admins where email = $1 and active`,
    [email]
  );

  const ok = await verify(row?.password_hash ?? DUMMY_HASH, password).catch(
    () => false
  );
  return row && ok ? toPlatformAdmin(row) : undefined;
}

export async function createPlatformSession(
  adminId: number
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await transaction(CONTROL_DB, async (client) => {
    await client.query("delete from platform_sessions where expires_at < now()");
    await client.query(
      "insert into platform_sessions (token, admin_id, expires_at) values ($1, $2, $3)",
      [token, adminId, expiresAt]
    );
  });

  return { token, expiresAt };
}

export async function findPlatformSessionAdmin(
  token: string | undefined
): Promise<PlatformAdmin | undefined> {
  if (!token) return undefined;

  const row = await queryOne<AdminRow>(
    CONTROL_DB,
    `select a.id, a.email, a.name, a.password_hash, a.must_change_password
     from platform_sessions s join platform_admins a on a.id = s.admin_id
     where s.token = $1 and s.expires_at > now() and a.active`,
    [token]
  );
  return row ? toPlatformAdmin(row) : undefined;
}

export async function deletePlatformSession(token: string | undefined) {
  if (!token) return;
  await query(CONTROL_DB, "delete from platform_sessions where token = $1", [token]);
}
