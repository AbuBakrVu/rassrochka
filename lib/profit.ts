// Доходность: сколько вложено в товар, сколько заработано и когда деньги
// вернулись.
//
// Закупочная цена восстанавливается из наценки сделки (purchasePrice в
// lib/data.ts) — та же формула, что у проводки «Закупка товара» в кассе.
// Полученные деньги — сумма кассовых записей «payment» по сделке: в неё уже
// входят первый взнос, досрочное погашение и отмены (отмена записана
// отрицательной суммой). Прибыль признаётся пропорционально полученным
// деньгам: в каждом рубле платежа доля маржи та же, что во всей сделке.

import { purchasePrice, type Deal } from "./data";
import { scheduleForDeal } from "./schedule";
import { todayIso } from "./status";
import type { CashTx, Coinvestor, CoinvestorProfitTx } from "./store";

const DAY_MS = 86_400_000;

export interface DealProfit {
  deal: Deal;
  /** Вся цена продажи: в рассрочку + первый взнос. */
  sale: number;
  purchase: number;
  margin: number;
  /** Наценка к закупке, 0–1. */
  markup: number;
  collected: number;
  /** Признанная прибыль по уже полученным деньгам. */
  earned: number;
  /** Начислено соинвесторам с платежей этой сделки. */
  coinvestorShare: number;
  /** Закупка вернулась: дата или null. */
  paybackDate: string | null;
  /** Дней от выдачи до возврата закупки; для невернувшихся — плановый срок по графику. */
  paybackDays: number | null;
  /** Сделка ещё не окупилась, срок — по графику платежей. */
  paybackPlanned: boolean;
}

export interface MonthProfit {
  key: string;
  label: string;
  title: string;
  /** Полученные платежи за месяц. */
  collected: number;
  /** Признанная прибыль за месяц. */
  earned: number;
}

export interface CoinvestorReturn {
  coinvestor: Coinvestor;
  /** Начислено / капитал, 0–1. */
  roi: number;
  /** В пересчёте на год, 0–1; null — вложено меньше месяца назад. */
  roiYear: number | null;
}

export interface ProfitReport {
  deals: DealProfit[];
  invested: number;
  sale: number;
  margin: number;
  collected: number;
  earned: number;
  coinvestorShare: number;
  /** Прибыль компании после доли соинвесторов. */
  net: number;
  /** Средняя наценка, взвешенная по закупке, 0–1. */
  markup: number;
  /** Средний срок окупаемости уже окупившихся сделок, дней. */
  avgPaybackDays: number | null;
  paidBack: number;
  /** Ещё не вернувшаяся часть закупки по активным сделкам. */
  atWork: number;
  byMonth: MonthProfit[];
  coinvestors: CoinvestorReturn[];
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "short" });

const monthTitle = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

export function computeProfit(
  deals: Deal[],
  cash: CashTx[],
  coinvestors: Coinvestor[],
  profitTx: CoinvestorProfitTx[],
  today = todayIso()
): ProfitReport {
  const issued = deals.filter((d) => d.stage === "active" || d.stage === "closed");
  const payments = cash
    .filter((t) => t.kind === "payment" && t.dealId)
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id));

  const shareByDeal = new Map<string, number>();
  for (const t of profitTx) {
    if (t.kind !== "accrual" || !t.dealId) continue;
    shareByDeal.set(t.dealId, (shareByDeal.get(t.dealId) ?? 0) + t.amount);
  }

  const marginRatio = new Map<string, number>();
  const rows: DealProfit[] = issued.map((deal) => {
    const sale = deal.amount + (deal.downPayment ?? 0);
    const purchase = purchasePrice(deal.amount, deal.markupPct, deal.downPayment ?? 0);
    const margin = sale - purchase;
    marginRatio.set(deal.id, sale ? margin / sale : 0);

    let collected = 0;
    let paybackDate: string | null = null;
    for (const t of payments) {
      if (t.dealId !== deal.id) continue;
      collected += t.amount;
      if (!paybackDate && collected >= purchase) paybackDate = t.date.slice(0, 10);
      // отмена платежа может «вернуть» сделку в неокупившиеся
      if (paybackDate && collected < purchase) paybackDate = null;
    }

    let paybackDays: number | null = paybackDate ? daysBetween(deal.openedAt, paybackDate) : null;
    let paybackPlanned = false;
    if (!paybackDate && deal.stage === "active") {
      // План по графику: первый взнос, после которого закупка вернётся
      let sum = deal.downPayment ?? 0;
      const point = scheduleForDeal(deal, 0).find((p) => (sum += p.amount) >= purchase);
      if (point) {
        paybackDays = daysBetween(deal.openedAt, point.iso);
        paybackPlanned = true;
      }
    }

    return {
      deal,
      sale,
      purchase,
      margin,
      markup: purchase ? margin / purchase : 0,
      collected,
      earned: sale ? Math.max(collected, 0) * (margin / sale) : 0,
      coinvestorShare: shareByDeal.get(deal.id) ?? 0,
      paybackDate,
      paybackDays,
      paybackPlanned,
    };
  });

  // Прибыль по месяцам — по датам платежей, последние 12 месяцев
  const months: MonthProfit[] = [];
  const now = new Date(`${today}T00:00:00`);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: monthLabel(key), title: monthTitle(key), collected: 0, earned: 0 });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const t of payments) {
    const ratio = marginRatio.get(t.dealId!);
    const i = monthIndex.get(t.date.slice(0, 7));
    if (ratio === undefined || i === undefined) continue;
    months[i].collected += t.amount;
    months[i].earned += t.amount * ratio;
  }

  const sum = (f: (r: DealProfit) => number) => rows.reduce((s, r) => s + f(r), 0);
  const invested = sum((r) => r.purchase);
  const margin = sum((r) => r.margin);
  const earned = sum((r) => r.earned);
  const coinvestorShare = sum((r) => r.coinvestorShare);
  const paid = rows.filter((r) => r.paybackDate && r.paybackDays !== null);

  return {
    deals: rows,
    invested,
    sale: sum((r) => r.sale),
    margin,
    collected: sum((r) => r.collected),
    earned,
    coinvestorShare,
    net: earned - coinvestorShare,
    markup: invested ? margin / invested : 0,
    avgPaybackDays: paid.length
      ? Math.round(paid.reduce((s, r) => s + r.paybackDays!, 0) / paid.length)
      : null,
    paidBack: paid.length,
    atWork: rows
      .filter((r) => r.deal.stage === "active")
      .reduce((s, r) => s + Math.max(r.purchase - r.collected, 0), 0),
    byMonth: months,
    coinvestors: coinvestors.map((c) => {
      const days = daysBetween(c.startedAt.slice(0, 10), today);
      const roi = c.capital > 0 ? c.accrued / c.capital : 0;
      return { coinvestor: c, roi, roiYear: days >= 30 && c.capital > 0 ? (roi * 365) / days : null };
    }),
  };
}
