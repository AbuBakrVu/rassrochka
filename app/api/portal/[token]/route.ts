// Публичный эндпоинт кабинета заёмщика: без авторизации, по случайному
// токену. Токен может быть клиентским (одна ссылка на все его сделки,
// см. loadPortalClient) или, для старых уже разосланных ссылок,
// токеном конкретной сделки (loadPortalDeal) — пробуем оба, порядок
// значения не имеет, так как токены генерируются независимо и не
// пересекаются.

import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { loadPortalClient, loadPortalDeal, loadPortalOffer } from "@/lib/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const tenant = await resolveTenant(request.headers.get("host"));

    const client = await loadPortalClient(tenant.dbName, token);
    if (client) {
      // Предодобренный лимит — дополнение: его сбой не должен ломать кабинет
      const offer = await loadPortalOffer(tenant.dbName, token).catch(() => null);
      return NextResponse.json({ kind: "client", ...client, offer });
    }

    const deal = await loadPortalDeal(tenant.dbName, token);
    if (deal) {
      return NextResponse.json({ kind: "deal", ...deal });
    }

    // Неизвестный токен и несуществующая компания отвечают одинаково:
    // по ответу нельзя перебором понять, какие токены существуют
    return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
  }
}
