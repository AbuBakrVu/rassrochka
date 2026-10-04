// Публичный файл календаря для кабинета заёмщика: будущие платежи по всем
// активным сделкам этого токена. Доступ — как у самого кабинета, по токену.

import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { loadPortalClient, loadPortalDeal } from "@/lib/queries";
import { scheduleForDeal } from "@/lib/schedule";
import { todayIso } from "@/lib/status";
import { buildPaymentsCalendar, type CalendarPayment } from "@/lib/ics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const tenant = await resolveTenant(request.headers.get("host"));

    const client = await loadPortalClient(tenant.dbName, token);
    const deals = client
      ? client.deals.filter((d) => d.stage === "active")
      : await loadPortalDeal(tenant.dbName, token).then((d) => (d ? [d] : undefined));
    if (!deals) {
      return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
    }

    const today = todayIso();
    const payments: CalendarPayment[] = deals.flatMap((deal) =>
      scheduleForDeal(deal, deal.paid)
        .filter((p) => p.status === "due" && p.iso >= today)
        .map((p) => ({
          uid: `${deal.id}-${p.n}`,
          iso: p.iso,
          amount: p.amount,
          product: deal.product,
          dealId: deal.id,
        }))
    );

    // Адрес — из Host, а не request.url: за Caddy request.url видит
    // внутренний адрес контейнера
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const portalUrl = `${proto}://${request.headers.get("host")}/pay/${token}`;
    const body = buildPaymentsCalendar(payments, tenant.name, portalUrl);

    return new NextResponse(body, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="platezhi.ics"',
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
  }
}
