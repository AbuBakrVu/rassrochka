// Автоначисление соинвестору в режиме «фиксированный % в месяц».
//
// За каждый закончившийся месяц начисляется ставка от СРЕДНЕГО капитала за
// этот месяц (по дням): внёс 100 000 пятнадцатого числа — за этот месяц
// получит примерно половину ставки, снял часть капитала — со дня снятия
// процент идёт с меньшей суммы. Так не нужно ничего делить вручную.
//
// Чистые функции: данные приходят из журнала капитала, проверяются тестом
// lib/coinvestor-accrual.test.ts. Запись начислений — lib/queries.ts
// (accrueFixedCoinvestors), один раз за месяц благодаря уникальному индексу.

export interface CapitalMove {
  /** ISO-дата движения. */
  date: string;
  /** Пополнение и реинвестирование — плюс, снятие — минус. */
  delta: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-03-17" → "2026-03-01". */
export const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;

function nextMonth(period: string): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
}

function daysIn(period: string): number {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Месяцы, за которые пора начислить: с месяца `since` по прошлый
 * относительно `today` включительно (текущий ещё не закончился).
 */
export function periodsToAccrue(since: string, today: string, done: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const current = monthStart(today);
  for (let p = monthStart(since); p < current; p = nextMonth(p)) {
    if (!done.has(p)) out.push(p);
  }
  return out;
}

/** Средний за месяц капитал по дням: капитал дня — сумма движений до конца этого дня. */
export function averageCapital(moves: readonly CapitalMove[], period: string): number {
  const days = daysIn(period);
  const prefix = period.slice(0, 8); // "2026-03-"
  const sorted = [...moves].sort((a, b) => a.date.localeCompare(b.date));

  let total = 0;
  let i = 0;
  let capital = 0;
  for (let d = 1; d <= days; d++) {
    const day = prefix + pad(d);
    while (i < sorted.length && sorted[i].date <= day) capital += sorted[i++].delta;
    total += Math.max(0, capital);
  }
  return total / days;
}

/** Начисление за месяц в рублях с копейками; 0 — начислять нечего. */
export function fixedAccrual(moves: readonly CapitalMove[], period: string, monthlyRatePct: number): number {
  if (monthlyRatePct <= 0) return 0;
  return Math.round(averageCapital(moves, period) * monthlyRatePct) / 100;
}

const MONTHS_NOM = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

/** "2026-03-01" → "март 2026". */
export const periodLabel = (period: string) =>
  `${MONTHS_NOM[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
