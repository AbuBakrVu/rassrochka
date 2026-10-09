// Период для Аналитики → Обзор и такой же отрезок прошлого периода для
// сравнения: «1–9 октября» сравнивается с «1–9 сентября», а не с целым
// сентябрём — иначе в начале месяца всё выглядело бы провалом.
// Даты — строки ГГГГ-ММ-ДД, сравниваются как строки. Тест: lib/period.test.ts.

export type PeriodKey = "month" | "quarter" | "year" | "all";

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  month: "Месяц",
  quarter: "Квартал",
  year: "Год",
  all: "Всё время",
};

export interface Range {
  from: string;
  to: string;
}

export interface PeriodRanges {
  current: Range | null;
  previous: Range | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Сдвиг даты на `months` месяцев назад; день обрезается до длины месяца (31 марта → 28/29 февраля). */
function shiftBack(y: number, m: number, d: number, months: number): string {
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return iso(ny, nm, Math.min(d, daysIn(ny, nm)));
}

export function periodRanges(key: PeriodKey, today: string): PeriodRanges {
  if (key === "all") return { current: null, previous: null };
  const [y, m, d] = today.split("-").map(Number);
  const startMonth = key === "month" ? m : key === "quarter" ? m - ((m - 1) % 3) : 1;
  const length = key === "month" ? 1 : key === "quarter" ? 3 : 12;
  return {
    current: { from: iso(y, startMonth, 1), to: today },
    previous: { from: shiftBack(y, startMonth, 1, length), to: shiftBack(y, m, d, length) },
  };
}

export const inRange = (date: string, r: Range | null) =>
  r === null || (date.slice(0, 10) >= r.from && date.slice(0, 10) <= r.to);

/** Изменение к прошлому периоду в процентах; null — сравнивать не с чем. */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
