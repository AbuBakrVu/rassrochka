import "server-only";

// Общая обвязка API-роутов: определение компании, разбор тела, единый
// формат ошибок. Роуты остаются тонкими — вся работа в lib/queries.ts.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TenantNotFoundError, resolveTenant, type Tenant } from "@/lib/tenant";
import {
  ForbiddenError,
  SESSION_COOKIE,
  UnauthorizedError,
  findSessionUser,
  type SessionUser,
} from "@/lib/auth";

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

type Handler<T> = (ctx: {
  tenant: Tenant;
  body: unknown;
  user: SessionUser;
}) => Promise<T>;

interface Options {
  /** Роут только для администратора компании. */
  adminOnly?: boolean;
}

export async function handle<T>(
  request: Request,
  fn: Handler<T>,
  options: Options = {}
): Promise<NextResponse> {
  try {
    const tenant = await resolveTenant(request.headers.get("host"));

    // Единственная точка проверки доступа: через handle() проходят все
    // роуты, кроме публичных входа и кабинета заёмщика
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await findSessionUser(tenant.dbName, token);
    if (!user) throw new UnauthorizedError();
    if (options.adminOnly && user.role !== "admin") throw new ForbiddenError();

    // Тело читаем как текст: у части запросов его нет вовсе (например,
    // «принять платёж» — всё нужное уже в пути), и request.json() на
    // пустом теле бросает исключение
    let body: unknown = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const raw = await request.text();
      if (raw.trim() !== "") {
        try {
          body = JSON.parse(raw);
        } catch {
          throw new BadRequestError("Тело запроса — не JSON");
        }
      }
    }

    return NextResponse.json(await fn({ tenant, body, user }));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof TenantNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BadRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Наружу не отдаём текст ошибки БД: он может содержать имена таблиц,
    // куски запроса и значения полей
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api]", message);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}

// ── Проверка входящих полей ────────────────────────────────────────────

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Ожидался объект");
  }
  return body as Record<string, unknown>;
}

export function str(body: unknown, key: string, { max = 500 } = {}): string {
  const value = asRecord(body)[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestError(`Поле «${key}» обязательно`);
  }
  if (value.length > max) {
    throw new BadRequestError(`Поле «${key}» длиннее ${max} символов`);
  }
  return value.trim();
}

export function optionalStr(body: unknown, key: string, fallback = ""): string {
  const value = asRecord(body)[key];
  return typeof value === "string" ? value.trim() : fallback;
}

export function num(
  body: unknown,
  key: string,
  { min = -Infinity, max = Infinity, integer = false } = {}
): number {
  const value = asRecord(body)[key];
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new BadRequestError(`Поле «${key}» должно быть числом`);
  }
  if (integer && !Number.isInteger(n)) {
    throw new BadRequestError(`Поле «${key}» должно быть целым`);
  }
  if (n < min || n > max) {
    throw new BadRequestError(`Поле «${key}» вне допустимого диапазона`);
  }
  return n;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(body: unknown, key: string): string {
  const value = str(body, key, { max: 10 });
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequestError(`Поле «${key}» должно быть датой вида ГГГГ-ММ-ДД`);
  }
  return value;
}
