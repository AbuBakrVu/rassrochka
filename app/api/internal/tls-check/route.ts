// Caddy спрашивает сюда перед выпуском сертификата под поддомен
// (on_demand_tls → ask, см. MIGRATION.md §7.2). Без этой проверки любой,
// направив свой домен на наш IP, заставил бы выпускать сертификаты и упёр
// нас в лимиты Let's Encrypt.

import { NextResponse } from "next/server";
import { findTenant } from "@/lib/tenant";
import { parseHost } from "@/lib/tenant-host";

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  const parsed = parseHost(domain);

  // Сам корневой домен сертификат тоже получает
  if (parsed.kind === "root") return new NextResponse("ok");
  if (parsed.kind !== "tenant") return new NextResponse("no", { status: 404 });

  try {
    await findTenant(parsed.slug);
    return new NextResponse("ok");
  } catch {
    return new NextResponse("no", { status: 404 });
  }
}
