// Публичный эндпоинт кабинета заёмщика: без авторизации, по случайному
// токену. Отдаёт одну сделку — см. loadPortalDeal.

import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { loadPortalDeal } from "@/lib/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const tenant = await resolveTenant(request.headers.get("host"));
    const deal = await loadPortalDeal(tenant.dbName, token);

    // Неизвестный токен и несуществующая компания отвечают одинаково:
    // по ответу нельзя перебором понять, какие токены существуют
    if (!deal) {
      return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
    }
    return NextResponse.json(deal);
  } catch {
    return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
  }
}
