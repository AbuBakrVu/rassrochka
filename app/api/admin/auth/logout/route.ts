import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PLATFORM_SESSION_COOKIE, deletePlatformSession } from "@/lib/platform-auth";

export async function POST() {
  const store = await cookies();
  await deletePlatformSession(store.get(PLATFORM_SESSION_COOKIE)?.value);
  store.delete(PLATFORM_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
