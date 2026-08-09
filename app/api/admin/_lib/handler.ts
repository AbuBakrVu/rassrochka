import "server-only";

// Обвязка для /api/admin/*: те же приёмы, что в app/api/_lib/handler.ts
// (единый формат ошибок, разбор тела), но БЕЗ resolveTenant — у владельца
// платформы нет компании, а есть отдельная кука/таблица (lib/platform-auth.ts).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PLATFORM_SESSION_COOKIE,
  UnauthorizedError,
  findPlatformSessionAdmin,
  type PlatformAdmin,
} from "@/lib/platform-auth";
import { ProvisioningError } from "@/lib/provisioning";
import { BadRequestError } from "@/app/api/_lib/handler";

type Handler<T> = (ctx: { body: unknown; admin: PlatformAdmin }) => Promise<T>;

export async function handleAdmin<T>(
  request: Request,
  fn: Handler<T>
): Promise<NextResponse> {
  try {
    const token = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value;
    const admin = await findPlatformSessionAdmin(token);
    if (!admin) throw new UnauthorizedError();

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

    return NextResponse.json(await fn({ body, admin }));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ProvisioningError || err instanceof BadRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/admin]", message);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}
