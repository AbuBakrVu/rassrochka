// Логин владельца платформы. Публичный роут (сессии ещё нет), не проходит
// через handleAdmin().

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PLATFORM_SESSION_COOKIE,
  createPlatformSession,
  verifyPlatformCredentials,
} from "@/lib/platform-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Введите почту и пароль" }, { status: 400 });
  }

  const admin = await verifyPlatformCredentials(email, password);
  if (!admin) {
    return NextResponse.json({ error: "Неверная почта или пароль" }, { status: 401 });
  }

  const { token, expiresAt } = await createPlatformSession(admin.id);

  (await cookies()).set(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return NextResponse.json({ admin });
}
