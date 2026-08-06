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

export interface Installment {
  n: number;
  date: string;
  amount: number;
  remaining: number;
  status: "paid" | "due";
}

export function buildSchedule(
  amount: number,
  months: number,
  paid: number
): Installment[] {
  const monthly = Math.round(amount / months);
  const list: Installment[] = [];
  let remaining = amount;
  for (let i = 0; i < months; i++) {
    // Первый платёж — 5 сентября 2026, дальше ежемесячно
    const m = 8 + i; // сентябрь = индекс 8
    const year = 2026 + Math.floor(m / 12);
    const last = i === months - 1;
    const sum = last ? remaining : monthly;
    remaining -= sum;
    list.push({
      n: i + 1,
      date: `5 ${monthNames[m % 12]} ${year}`,
      amount: sum,
      remaining,
      status: i < paid ? "paid" : "due",
    });
  }
  return list;
}
