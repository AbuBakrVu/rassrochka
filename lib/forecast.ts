// Прогноз денежного потока на ближайшие месяцы — сколько денег придёт по
// графикам активных сделок, сколько из них уйдёт соинвесторам и каким будет
// остаток кассы. Чистая функция над данными стора.

import type { Deal } from "./data";
import { paidCount, purchasePrice } from "./data";
import { scheduleForDeal } from "./schedule";
import type { Coinvestor } from "./store";

export interface ForecastMonth {
  /** "2026-10" */
  key: string;
  /** Взносы по графику с датой в этом месяце (для текущего — с сегодня). */
  expected: number;
  installments: number;
  /** Доля активных соинвесторов с этих взносов. */
  coinvestorShare: number;
  net: number;
  /** Остаток кассы на конец месяца, если все взносы придут вовремя. */
  balanceAfter: number;
}

export interface CashForecast {
  months: ForecastMonth[];
  /** Уже просроченные взносы — придут неизвестно когда, в прогноз не входят. */
  overdue: number;
  overdueInstallments: number;
  /** Начислено соинвесторам, но ещё не выплачено — вычитается из стартового остатка. */
  owedToCoinvestors: number;
  startBalance: number;
}

const monthKey = (iso: string) => iso.slice(0, 7);

function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function computeCashForecast(input: {
  deals: Deal[];
  paidPayments: Record<string, number>;
  coinvestors: Coinvestor[];
  balance: number;
  today: string;
  horizon?: number;
}): CashForecast {
  const { deals, paidPayments, coinvestors, balance, today, horizon = 3 } = input;

  // Та же формула доли, что начисляется при приёме платежа
  // (accrueCoinvestorProfit в lib/queries.ts): маржа взноса × % соинвестора
  const sharePct = coinvestors
    .filter((c) => c.active)
    .reduce((s, c) => s + c.profitSharePct, 0);

  const keys = Array.from({ length: horizon }, (_, i) => addMonths(monthKey(today), i));
  const byMonth = new Map(keys.map((k) => [k, { expected: 0, installments: 0, share: 0 }]));

  let overdue = 0;
  let overdueInstallments = 0;

  for (const deal of deals) {
    if (deal.stage !== "active") continue;
    const purchase = purchasePrice(deal.amount, deal.markupPct, deal.downPayment ?? 0);
    const marginPerInstallment = Math.max(
      0,
      (deal.amount + (deal.downPayment ?? 0) - purchase) / deal.months
    );

    for (const p of scheduleForDeal(deal, paidCount(deal, paidPayments))) {
      if (p.status === "paid") continue;
      if (p.iso < today) {
        overdue += p.amount;
        overdueInstallments++;
        continue;
      }
      const bucket = byMonth.get(monthKey(p.iso));
      if (!bucket) continue;
      bucket.expected += p.amount;
      bucket.installments++;
      bucket.share += (marginPerInstallment * sharePct) / 100;
    }
  }

  const owedToCoinvestors = coinvestors.reduce((s, c) => s + Math.max(0, c.owed), 0);
  let running = balance - owedToCoinvestors;

  const months = keys.map((key) => {
    const b = byMonth.get(key)!;
    const net = b.expected - b.share;
    running += net;
    return {
      key,
      expected: b.expected,
      installments: b.installments,
      coinvestorShare: b.share,
      net,
      balanceAfter: running,
    };
  });

  return {
    months,
    overdue,
    overdueInstallments,
    owedToCoinvestors,
    startBalance: balance,
  };
}
