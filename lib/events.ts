// История сделки: лог событий, привязанных к dealId. Реконструируется для
// затравочных сделок (buildSeedEvents), дальше пополняется стором при
// реальных действиях (создание сделки, приём платежа).

import type { Deal } from "./data";
import { buildSchedule, money } from "./schedule";

export interface DealEvent {
  id: string;
  dealId: string;
  date: string; // ISO
  text: string;
}

export function dealEvents(events: DealEvent[], dealId: string): DealEvent[] {
  return events
    .filter((e) => e.dealId === dealId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function buildSeedEvents(
  deals: Deal[],
  paidPayments: Record<string, number>
): DealEvent[] {
  const events: DealEvent[] = [];

  for (const d of deals) {
    events.push({
      id: `${d.id}-created`,
      dealId: d.id,
      date: d.openedAt,
      text: `Сделка создана · ответственный ${d.manager}`,
    });

    if (d.stage === "active" || d.stage === "closed") {
      events.push({
        id: `${d.id}-active`,
        dealId: d.id,
        date: d.openedAt,
        text: "Переведена в «Активна»",
      });
    }

    if (d.stage === "rejected") {
      events.push({
        id: `${d.id}-rejected`,
        dealId: d.id,
        date: d.openedAt,
        text: `Заявка отклонена — ${d.nextStep.replace(/^Отказ:\s*/, "")}`,
      });
    }

    const paid = d.stage === "closed" ? d.months : (paidPayments[d.id] ?? 0);
    if (paid > 0) {
      const schedule = buildSchedule(d.amount, d.months, paid, d.openedAt);
      for (const p of schedule.slice(0, paid)) {
        events.push({
          id: `${d.id}-p${p.n}`,
          dealId: d.id,
          date: p.iso,
          text: `Платёж ${p.n} из ${d.months} принят — ${money(p.amount)}`,
        });
      }
    }
  }

  return events;
}
