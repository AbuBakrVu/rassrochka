import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveTenant } from "@/lib/tenant";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  try {
    const tenant = await resolveTenant(request.headers.get("host"));
    await deleteSession(tenant.dbName, token);
  } catch {
    // Даже если сессию не удалось стереть в БД, куку снимаем
  }

  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
