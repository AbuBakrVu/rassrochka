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
import { can, type Permission } from "@/lib/permissions";
import { assertClientInScope, assertDealInScope } from "@/lib/scope";

import { BadRequestError } from "@/lib/errors";

export { BadRequestError };

type Handler<T> = (ctx: {
  tenant: Tenant;
  body: unknown;
  user: SessionUser;
}) => Promise<T>;

interface Options {
  /** Роут только для администратора компании. */
  adminOnly?: boolean;
  /**
   * Право, без которого роут закрыт (lib/permissions.ts). Меню прячет
   * разделы, а этот флаг отсекает и прямые вызовы API в обход интерфейса.
   * Не указано — доступно любому вошедшему сотруднику.
   */
  perm?: Permission;
  /** Сделка/клиент запроса — должны быть в филиале сотрудника (lib/scope.ts). */
  dealId?: string;
  clientId?: string;
}

async function checkAccess(dbName: string, user: SessionUser, options: Options): Promise<void> {
  if (options.adminOnly && user.role !== "admin") throw new ForbiddenError();
  if (options.perm && !can(user, options.perm)) throw new ForbiddenError();
  if (options.dealId) await assertDealInScope(dbName, user, options.dealId);
  if (options.clientId) await assertClientInScope(dbName, user, options.clientId);
}

/**
 * Компания и сотрудник запроса — для роутов, которые отдают не JSON (файлы),
 * и потому не могут жить внутри handle(). Бросает те же ошибки доступа.
 */
export async function sessionFor(
  request: Request,
  options: Options = {}
): Promise<{ tenant: Tenant; user: SessionUser }> {
  const tenant = await resolveTenant(request.headers.get("host"));
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await findSessionUser(tenant.dbName, token);
  if (!user) throw new UnauthorizedError();
  await checkAccess(tenant.dbName, user, options);
  return { tenant, user };
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
    await checkAccess(tenant.dbName, user, options);

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

export function optionalNum(
  body: unknown,
  key: string,
  opts: { min?: number; max?: number; integer?: boolean } = {}
): number | undefined {
  const value = asRecord(body)[key];
  if (value === undefined || value === null || value === "") return undefined;
  return num(body, key, opts);
}

export function strArray(
  body: unknown,
  key: string,
  { maxItems = 50, maxLen = 100 } = {}
): string[] {
  const value = asRecord(body)[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new BadRequestError(`Поле «${key}» должно быть массивом`);
  }
  if (value.length > maxItems) {
    throw new BadRequestError(`Поле «${key}»: не больше ${maxItems} элементов`);
  }
  return value.map((v, i) => {
    if (typeof v !== "string" || v.trim() === "" || v.length > maxLen) {
      throw new BadRequestError(`Поле «${key}[${i}]» некорректно`);
    }
    return v.trim();
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(body: unknown, key: string): string {
  const value = str(body, key, { max: 10 });
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequestError(`Поле «${key}» должно быть датой вида ГГГГ-ММ-ДД`);
  }
  return value;
}
