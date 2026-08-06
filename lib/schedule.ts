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

export interface Installment {
  n: number;
  date: string;
  iso: string;
  amount: number;
  remaining: number;
  status: "paid" | "due";
}

// Первый платёж — через месяц после заключения, далее ежемесячно
export function buildSchedule(
  amount: number,
  months: number,
  paid: number,
  openedAt = "2026-08-05"
): Installment[] {
  const start = new Date(openedAt);
  const list: Installment[] = [];
  const monthly = Math.round(amount / months);
  let remaining = amount;
  for (let i = 0; i < months; i++) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth() + 1 + i,
      start.getDate()
    );
    const last = i === months - 1;
    const sum = last ? remaining : monthly;
    remaining -= sum;
    list.push({
      n: i + 1,
      date: longDate(date),
      iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      amount: sum,
      remaining,
      status: i < paid ? "paid" : "due",
    });
  }
  return list;
}
