// Касса: чистые функции над лентой операций.
// Деньги уходят при закупке товара для сделки и возвращаются с каждым
// платежом клиента — из этого складывается остаток и оборот.

import type { CashTx } from "./store";

export const cashBalance = (opening: number, txs: CashTx[]) =>
  txs.reduce((sum, t) => sum + t.amount, opening);

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
