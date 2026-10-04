// Качество портфеля: из каких сделок деньги возвращаются хуже.
//
// Выданными считаются активные и закрытые сделки — заявки и отказы денег не
// получали. Главная метрика — доля портфеля в просрочке (в микрофинансах
// её называют PAR): остаток по сделкам, у которых есть просроченный взнос,
// делённый на весь остаток. Считается по деньгам, а не по штукам: одна
// крупная просрочка опаснее трёх мелких.

import { daysOverdue, todayIso } from "./status";
import { paidCount, type Deal } from "./data";
import { restructureOf, scheduleForDeal } from "./schedule";
import { paymentPunctuality } from "./credit";
import type { CashTx, Employee } from "./store";

export interface QualityRow {
  key: string;
  label: string;
  /** Полная подпись — только у когорт по месяцам. */
  title?: string;
  /** Выдано сделок и на какую сумму (сумма в рассрочку + первый взнос). */
  issued: number;
  issuedSum: number;
  /** Остаток по активным сделкам. */
  outstanding: number;
  /** Активных сделок с просроченным взносом. */
  overdueDeals: number;
  activeDeals: number;
  /** Сумма просроченных взносов (не весь остаток, а то, что уже должны были заплатить). */
  overdueSum: number;
  /** Доля остатка в просрочке, 0–1. */
  par: number;
  /** То же, но только сделки с просрочкой больше 30 дней. */
  par30: number;
  /** Доля платежей вовремя, 0–1; null — платежей с датой по графику ещё нет. */
  onTimeRate: number | null;
  closed: number;
}

interface DealFacts {
  deal: Deal;
  outstanding: number;
  overdueSum: number;
  days: number;
}

function factsOf(deal: Deal, paidPayments: Record<string, number>, today: string): DealFacts {
  const paid = paidCount(deal, paidPayments);
  if (deal.stage !== "active") return { deal, outstanding: 0, overdueSum: 0, days: 0 };
  const schedule = scheduleForDeal(deal, paid);
  const due = schedule.filter((p) => p.status === "due");
  return {
    deal,
    outstanding: due.reduce((s, p) => s + p.amount, 0),
    overdueSum: due.filter((p) => p.iso < today).reduce((s, p) => s + p.amount, 0),
    days: daysOverdue(
      {
        stage: deal.stage,
        amount: deal.amount,
        months: deal.months,
        paid,
        openedAt: deal.openedAt,
        restructure: restructureOf(deal),
      },
      today
    ),
  };
}

function summarize(
  key: string,
  label: string,
  list: DealFacts[],
  cash: CashTx[]
): QualityRow {
  const outstanding = list.reduce((s, f) => s + f.outstanding, 0);
  const atRisk = list.filter((f) => f.days > 0);
  const atRisk30 = list.filter((f) => f.days > 30);
  const punctuality = paymentPunctuality(
    list.map((f) => f.deal),
    cash
  );
  return {
    key,
    label,
    issued: list.length,
    issuedSum: list.reduce((s, f) => s + f.deal.amount + (f.deal.downPayment ?? 0), 0),
    outstanding,
    overdueDeals: atRisk.length,
    activeDeals: list.filter((f) => f.deal.stage === "active").length,
    overdueSum: list.reduce((s, f) => s + f.overdueSum, 0),
    par: outstanding ? atRisk.reduce((s, f) => s + f.outstanding, 0) / outstanding : 0,
    par30: outstanding ? atRisk30.reduce((s, f) => s + f.outstanding, 0) / outstanding : 0,
    onTimeRate: punctuality.total ? punctuality.onTime / punctuality.total : null,
    closed: list.filter((f) => f.deal.stage === "closed").length,
  };
}

function groupBy(
  facts: DealFacts[],
  cash: CashTx[],
  keyOf: (d: Deal) => { key: string; label: string }
): QualityRow[] {
  const groups = new Map<string, { label: string; list: DealFacts[] }>();
  for (const f of facts) {
    const { key, label } = keyOf(f.deal);
    const g = groups.get(key) ?? { label, list: [] };
    g.list.push(f);
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, g]) => summarize(key, g.label, g.list, cash));
}

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "short" });

const monthTitle = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

export interface QualityReport {
  total: QualityRow;
  byManager: QualityRow[];
  byCategory: QualityRow[];
  /** Когорты по месяцу выдачи, по возрастанию, последние 12. */
  byMonth: QualityRow[];
}

export function computeQuality(
  deals: Deal[],
  paidPayments: Record<string, number>,
  cash: CashTx[],
  employees: Employee[],
  today = todayIso()
): QualityReport {
  const issued = deals.filter((d) => d.stage === "active" || d.stage === "closed");
  const facts = issued.map((d) => factsOf(d, paidPayments, today));
  const byRisk = (a: QualityRow, b: QualityRow) => b.par - a.par || b.outstanding - a.outstanding;

  return {
    total: summarize("all", "Весь портфель", facts, cash),
    byManager: groupBy(facts, cash, (d) => {
      const e = employees.find((x) => x.id === d.managerId);
      return e
        ? { key: String(e.id), label: e.name }
        : { key: "none", label: "Без ответственного" };
    }).sort(byRisk),
    byCategory: groupBy(facts, cash, (d) =>
      d.category ? { key: d.category, label: d.category } : { key: "none", label: "Без категории" }
    ).sort(byRisk),
    byMonth: groupBy(facts, cash, (d) => {
      const ym = d.openedAt.slice(0, 7);
      return { key: ym, label: monthLabel(ym) };
    })
      .map((r) => ({ ...r, title: monthTitle(r.key) }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12),
  };
}
