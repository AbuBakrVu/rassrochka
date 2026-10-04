// Распределение денег по графику — без базы и без React, чтобы правила
// можно было проверить тестами (lib/payments.test.ts).
//
// Состояние сделки по платежам — два числа:
//   paid   — сколько взносов закрыто полностью (deals.paid_count);
//   credit — сколько уже внесено в счёт следующего, ещё не закрытого
//            взноса (deals.credit): частичная оплата или переплата.
// Любой принятый платёж сначала гасит недостающее по текущему взносу,
// затем целиком следующие, а остаток становится новым credit. Так ни один
// рубль клиента не теряется — раньше остаток меньше взноса просто
// приписывался к последнему закрытому взносу и долг не уменьшал.

/** Копейки отбрасываем от погрешности округления — суммы в базе numeric(12,2). */
const EPS = 0.005;

export interface PaymentPart {
  /** Номер взноса, с 1. */
  installment: number;
  amount: number;
  /** Этой частью взнос закрыт полностью. */
  completes: boolean;
}

export type Allocation =
  | { ok: true; parts: PaymentPart[]; paid: number; credit: number }
  | { ok: false; error: "NOT_POSITIVE" | "TOO_HIGH"; max: number };

/** Сколько всего осталось внести по графику. */
export function remainingDue(amounts: number[], paid: number, credit: number): number {
  return round2(amounts.slice(paid).reduce((s, a) => s + a, 0) - credit);
}

/** Сколько осталось внести по ближайшему взносу. */
export function nextDue(amounts: number[], paid: number, credit: number): number {
  return paid < amounts.length ? round2(amounts[paid] - credit) : 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Делит поступившую сумму по взносам. Больше остатка долга принять нельзя:
 * лишние деньги — это уже не платёж по рассрочке, их надо вернуть клиенту.
 */
export function allocatePayment(
  amounts: number[],
  paid: number,
  credit: number,
  amount: number
): Allocation {
  const max = remainingDue(amounts, paid, credit);
  if (!(amount > EPS)) return { ok: false, error: "NOT_POSITIVE", max };
  if (amount > max + EPS) return { ok: false, error: "TOO_HIGH", max };

  const parts: PaymentPart[] = [];
  let pool = round2(amount);
  let n = paid;
  let have = credit;
  while (pool > EPS && n < amounts.length) {
    const need = round2(amounts[n] - have);
    if (pool + EPS >= need) {
      parts.push({ installment: n + 1, amount: need, completes: true });
      pool = round2(pool - need);
      n++;
      have = 0;
    } else {
      parts.push({ installment: n + 1, amount: pool, completes: false });
      have = round2(have + pool);
      pool = 0;
    }
  }
  return { ok: true, parts, paid: n, credit: n < amounts.length ? have : 0 };
}

/**
 * Состояние сделки по действующим (неотменённым) записям кассы о взносах:
 * используется после отмены платежа — пересчитать проще и надёжнее, чем
 * откатывать по шагам. Запись старого формата, где остаток переплаты
 * дописан к сумме взноса, просто закрывает свой взнос.
 */
export function stateFromPayments(
  amounts: number[],
  payments: { installment: number; amount: number }[]
): { paid: number; credit: number } {
  const sums = new Array<number>(amounts.length).fill(0);
  for (const p of payments) {
    if (p.installment >= 1 && p.installment <= amounts.length) {
      sums[p.installment - 1] += p.amount;
    }
  }
  let paid = 0;
  while (paid < amounts.length && sums[paid] + EPS >= amounts[paid]) paid++;
  return { paid, credit: paid < amounts.length ? round2(sums[paid]) : 0 };
}
