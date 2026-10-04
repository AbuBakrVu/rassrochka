// Публичный эндпоинт кабинета соинвестора: без входа, по случайному токену
// (coinvestors.portal_token). Отдаёт только суммы самого соинвестора.

import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { loadInvestorPortal } from "@/lib/queries";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Токен — 128 случайных бит, но перебор всё равно глушим
  if (!checkRateLimit(`investor:${clientIp(request)}`, 60)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  try {
    const tenant = await resolveTenant(request.headers.get("host"));
    const portal = await loadInvestorPortal(tenant.dbName, token);
    if (portal) return NextResponse.json(portal);
  } catch {
    // Несуществующая компания отвечает так же, как неизвестный токен
  }
  return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
}
