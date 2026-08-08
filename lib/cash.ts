// Касса: чистые функции над лентой операций.
// Деньги уходят при закупке товара для сделки и возвращаются с каждым
// платежом клиента — из этого складывается остаток и оборот.

import { paidCount, type Deal } from "./data";
import { buildSchedule } from "./schedule";
import type { CashTx } from "./store";

// Закупочная цена — та же формула, что на странице сделки и в аналитике:
// наценка условно 15% от суммы рассрочки (см. PROGRESS_PRO.md §5)
export const purchasePrice = (deal: Deal) =>
  deal.amount - Math.round(deal.amount * 0.15);

export const cashBalance = (opening: number, txs: CashTx[]) =>
  txs.reduce((sum, t) => sum + t.amount, opening);

// Стартовая лента: восстанавливаем историю по уже существующим сделкам,
// чтобы касса не выглядела пустой на свежем сторе.
export function buildSeedCash(
  deals: Deal[],
  paidPayments: Record<string, number>
): CashTx[] {
  const txs: CashTx[] = [];

  for (const deal of deals) {
    if (deal.stage === "rejected") continue;

    txs.push({
      id: `${deal.id}-purchase`,
      kind: "purchase",
      amount: -purchasePrice(deal),
      date: deal.openedAt,
      dealId: deal.id,
      title: `Закупка товара · ${deal.product}`,
      note: deal.client,
    });

    const paid = paidCount(deal, paidPayments);
    if (paid === 0) continue;

    const schedule = buildSchedule(
      deal.amount,
      deal.months,
      paid,
      deal.openedAt
    );
    for (const p of schedule.filter((x) => x.status === "paid")) {
      txs.push({
        id: `${deal.id}-p${p.n}`,
        kind: "payment",
        amount: p.amount,
        date: p.iso,
        dealId: deal.id,
        title: `Платёж ${p.n} из ${deal.months} · ${deal.client}`,
        note: deal.product,
      });
    }
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

export interface CashSummary {
  balance: number;
  income: number;
  expense: number;
  monthIncome: number;
  monthExpense: number;
}

export function cashSummary(
  opening: number,
  txs: CashTx[],
  monthPrefix: string
): CashSummary {
  let income = 0;
  let expense = 0;
  let monthIncome = 0;
  let monthExpense = 0;

  for (const t of txs) {
    if (t.amount >= 0) {
      income += t.amount;
      if (t.date.startsWith(monthPrefix)) monthIncome += t.amount;
    } else {
      expense += -t.amount;
      if (t.date.startsWith(monthPrefix)) monthExpense += -t.amount;
    }
  }

  return {
    balance: opening + income - expense,
    income,
    expense,
    monthIncome,
    monthExpense,
  };
}
