// Общий расчёт графика платежей: используется в CRM и в клиентском кабинете

export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";

export const monthNames = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export const longDate = (d: Date) =>
  `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface Installment {
  n: number;
  date: string;
  iso: string;
  amount: number;
  remaining: number;
  status: "paid" | "due";
  /**
   * Уже внесено в счёт этого взноса (частичная оплата или переплата, см.
   * lib/payments.ts). amount у такого взноса — сколько осталось внести.
   */
  credited?: number;
}

/**
 * Реструктуризация: остаток на дату реструктуризации размазан по новому
 * графику из restructuredMonths месяцев начиная с from. originalMonths —
 * months ДО реструктуризации, нужен, чтобы верно восстановить суммы
 * взносов, оплаченных ещё по старому графику (см. buildSchedule).
 */
export interface RestructureInfo {
  originalMonths: number;
  restructuredMonths: number;
  from: string;
}

// Первый платёж — через месяц после заключения, далее ежемесячно
export function buildSchedule(
  amount: number,
  months: number,
  paid: number,
  openedAt = "2026-08-05",
  restructure?: RestructureInfo
): Installment[] {
  const list: Installment[] = [];

  if (!restructure) {
    const start = new Date(openedAt);
    const monthly = Math.round(amount / months);
    let remaining = amount;
    for (let i = 0; i < months; i++) {
      const date = new Date(start.getFullYear(), start.getMonth() + 1 + i, start.getDate());
      const last = i === months - 1;
      const sum = last ? remaining : monthly;
      remaining -= sum;
      list.push({
        n: i + 1,
        date: longDate(date),
        iso: isoOf(date),
        amount: sum,
        remaining,
        status: i < paid ? "paid" : "due",
      });
    }
    return list;
  }

  // Взносы до реструктуризации — по старому графику (originalMonths),
  // их суммы не пересчитываются задним числом.
  const splitPoint = months - restructure.restructuredMonths;
  const start = new Date(openedAt);
  const monthlyOriginal = Math.round(amount / restructure.originalMonths);
  let remaining = amount;
  for (let i = 0; i < splitPoint; i++) {
    const date = new Date(start.getFullYear(), start.getMonth() + 1 + i, start.getDate());
    remaining -= monthlyOriginal;
    list.push({
      n: i + 1,
      date: longDate(date),
      iso: isoOf(date),
      amount: monthlyOriginal,
      remaining,
      status: i < paid ? "paid" : "due",
    });
  }

  // Остаток на момент реструктуризации — по новому графику с нужной даты
  const rStart = new Date(restructure.from);
  const rMonthly = Math.round(remaining / restructure.restructuredMonths);
  let rRemaining = remaining;
  for (let i = 0; i < restructure.restructuredMonths; i++) {
    const date = new Date(rStart.getFullYear(), rStart.getMonth() + i, rStart.getDate());
    const last = i === restructure.restructuredMonths - 1;
    const sum = last ? rRemaining : rMonthly;
    rRemaining -= sum;
    const n = splitPoint + i;
    list.push({
      n: n + 1,
      date: longDate(date),
      iso: isoOf(date),
      amount: sum,
      remaining: rRemaining,
      status: n < paid ? "paid" : "due",
    });
  }

  return list;
}

/** Достаёт RestructureInfo из полей сделки — undefined, если не реструктурирована. */
export function restructureOf(deal: {
  originalMonths?: number | null;
  restructuredMonths?: number | null;
  restructuredFrom?: string | null;
}): RestructureInfo | undefined {
  if (!deal.originalMonths || !deal.restructuredMonths || !deal.restructuredFrom) {
    return undefined;
  }
  return {
    originalMonths: deal.originalMonths,
    restructuredMonths: deal.restructuredMonths,
    from: deal.restructuredFrom,
  };
}

/**
 * График сделки с учётом реструктуризации, если она была, и уже
 * внесённого в счёт ближайшего взноса (credit): его amount — сколько
 * осталось доплатить. Для плановых сумм без учёта оплат — buildSchedule.
 */
export function scheduleForDeal(
  deal: {
    amount: number;
    months: number;
    openedAt: string;
    originalMonths?: number | null;
    restructuredMonths?: number | null;
    restructuredFrom?: string | null;
    credit?: number;
  },
  paid: number
): Installment[] {
  const list = buildSchedule(deal.amount, deal.months, paid, deal.openedAt, restructureOf(deal));
  const credit = deal.credit ?? 0;
  const next = list.find((p) => p.status === "due");
  if (next && credit > 0) {
    next.credited = Math.min(credit, next.amount);
    next.amount = Math.round((next.amount - next.credited) * 100) / 100;
  }
  return list;
}

/** Сколько клиент уже внёс по графику: закрытые взносы плюс внесённое в счёт следующего. */
export const paidTotal = (schedule: Installment[]) =>
  schedule.reduce((s, p) => s + (p.status === "paid" ? p.amount : (p.credited ?? 0)), 0);
