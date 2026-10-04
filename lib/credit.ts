// Надёжность клиента и его лимит рассрочки.
//
// Всё считается на лету из того, что уже есть в сторе: сделок, графиков и
// кассовых записей о платежах. Отдельно хранится только ручной лимит,
// который задал администратор (clients.credit_limit), и базовый лимит
// компании (settings.client_default_limit). Каждое правило видно
// менеджеру в списке причин: решение не должно выглядеть чёрным ящиком.

import { assessRisk, dealsOfClient, paidCount, type Client, type Deal, type RiskAssessment } from "./data";
import { paidTotal, scheduleForDeal } from "./schedule";
import type { CashTx } from "./store";

const DAY_MS = 86_400_000;

/**
 * Сколько дней после даты взноса платёж ещё считается «вовремя». Те же
 * 3 дня, что у мягкой ступени лесенки напоминаний («Просрочка 1–3 дня»).
 */
export const GRACE_DAYS = 3;

export interface Punctuality {
  /** Платежей, по которым удалось сопоставить дату с графиком. */
  total: number;
  onTime: number;
  late: number;
  /** Средняя задержка по опоздавшим платежам, дней. */
  avgLateDays: number;
  maxLateDays: number;
}

/**
 * Дисциплина платежей клиента: каждый принятый платёж сравнивается с датой
 * своего взноса по графику. Отменённые платежи и сами записи-отмены не
 * учитываются, как и старые записи без номера взноса (до миграции 015).
 */
export function paymentPunctuality(deals: Deal[], cash: CashTx[]): Punctuality {
  const ids = new Set(deals.map((d) => d.id));
  const reversed = new Set(cash.filter((t) => t.reversesId).map((t) => t.reversesId));
  const dueByDeal = new Map<string, Map<number, string>>();
  for (const d of deals) {
    const schedule = scheduleForDeal(d, d.months);
    dueByDeal.set(d.id, new Map(schedule.map((p) => [p.n, p.iso])));
  }

  let onTime = 0;
  const lateDays: number[] = [];
  for (const t of cash) {
    if (t.kind !== "payment" || !t.dealId || !ids.has(t.dealId)) continue;
    if (t.reversesId || reversed.has(t.id) || !t.installmentNumber) continue;
    const due = dueByDeal.get(t.dealId)?.get(t.installmentNumber);
    if (!due) continue;
    const days = Math.round(
      (Date.parse(`${t.date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / DAY_MS
    );
    if (days > GRACE_DAYS) lateDays.push(days);
    else onTime++;
  }

  return {
    total: onTime + lateDays.length,
    onTime,
    late: lateDays.length,
    avgLateDays: lateDays.length
      ? Math.round(lateDays.reduce((s, d) => s + d, 0) / lateDays.length)
      : 0,
    maxLateDays: lateDays.length ? Math.max(...lateDays) : 0,
  };
}

export type LimitSource = "manual" | "auto" | "off" | "blacklist";

export interface ClientCredit {
  risk: RiskAssessment;
  punctuality: Punctuality;
  /** null — лимит не ограничен (автоматический лимит выключен в настройках). */
  limit: number | null;
  source: LimitSource;
  /** Как получен лимит — одной строкой для подсказки. */
  note: string;
  /** Занято: остаток по активным сделкам + суммы заявок в работе. */
  used: number;
  /** null — без ограничения. Может быть отрицательным, если лимит уже превышен. */
  available: number | null;
}

/** Множитель лимита к крупнейшей полностью выплаченной сделке. */
const CLOSED_DEAL_FACTOR = 1.5;

const roundDown = (n: number) => Math.floor(n / 1000) * 1000;

export function computeClientCredit(
  client: Client,
  deals: Deal[],
  paidPayments: Record<string, number>,
  cash: CashTx[],
  defaultLimit: number
): ClientCredit {
  const own = dealsOfClient(deals, client.id);
  const punctuality = paymentPunctuality(own, cash);
  const risk = assessRisk(deals, client.id, punctuality);

  let used = 0;
  for (const d of own) {
    if (d.stage === "active") {
      const paidSum = paidTotal(scheduleForDeal(d, paidCount(d, paidPayments)));
      used += d.amount - paidSum;
    } else if (d.stage === "new" || d.stage === "check" || d.stage === "signing") {
      used += d.amount;
    }
  }

  let limit: number | null;
  let source: LimitSource;
  let note: string;

  if (client.blacklistedAt) {
    limit = 0;
    source = "blacklist";
    note = "Клиент в чёрном списке — новые рассрочки не выдаются";
  } else if (client.creditLimit !== undefined) {
    limit = client.creditLimit;
    source = "manual";
    note = "Задан администратором вручную";
  } else if (defaultLimit <= 0) {
    limit = null;
    source = "off";
    note = "Автоматический лимит выключен в настройках";
  } else {
    const biggestClosed = Math.max(
      0,
      ...own.filter((d) => d.stage === "closed").map((d) => d.amount + (d.downPayment ?? 0))
    );
    const byHistory = roundDown(biggestClosed * CLOSED_DEAL_FACTOR);
    limit = Math.max(defaultLimit, byHistory);
    note =
      byHistory > defaultLimit
        ? `В 1,5 раза больше крупнейшей выплаченной сделки`
        : "Базовый лимит компании";
    if (risk.tone === "red") {
      limit = roundDown(limit / 2);
      note += ", снижен вдвое из-за повышенного риска";
    }
    source = "auto";
  }

  return {
    risk,
    punctuality,
    limit,
    source,
    note,
    used,
    available: limit === null ? null : limit - used,
  };
}

export const SOURCE_LABEL: Record<LimitSource, string> = {
  manual: "вручную",
  auto: "автоматически",
  off: "без лимита",
  blacklist: "закрыт",
};
