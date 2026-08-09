// Публичный роут: не проходит через handle(), потому что именно здесь
// сессии ещё нет.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TenantNotFoundError, resolveTenant } from "@/lib/tenant";
import { SESSION_COOKIE, createSession, verifyCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const tenant = await resolveTenant(request.headers.get("host"));
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;

    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Введите почту и пароль" }, { status: 400 });
    }

    const user = await verifyCredentials(tenant.dbName, email, password);
    if (!user) {
      // Один и тот же текст для неизвестной почты и неверного пароля —
      // иначе форма подсказывает, какие адреса заведены в системе
      return NextResponse.json({ error: "Неверная почта или пароль" }, { status: 401 });
    }

    const { token, expiresAt } = await createSession(tenant.dbName, user.id);

    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
      // domain НЕ указываем намеренно: кука должна остаться на своём
      // поддомене, иначе сессия acme.<домен> утекла бы на beta.<домен>
    });

    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof TenantNotFoundError) {
      return NextResponse.json(
        { error: "Компания по этому адресу не найдена" },
        { status: 404 }
      );
    }
    console.error("[login]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Не удалось войти" }, { status: 500 });
  }
}
