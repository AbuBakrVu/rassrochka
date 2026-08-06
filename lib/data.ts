// Моковые данные CRM «Финора» — учёт рассрочек. Август 2026.

export const fmt = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₽";

export type DealStage = "new" | "check" | "signing" | "active";

export interface Deal {
  id: string;
  client: string;
  amount: number;
  months: number;
  stage: DealStage;
  status: string;
  statusTone: "blue" | "yellow" | "green" | "red";
  nextStep: string;
  deadline?: string;
  urgent?: boolean;
  manager: string;
}

export const stages: { key: DealStage; title: string }[] = [
  { key: "new", title: "Новая заявка" },
  { key: "check", title: "Проверка" },
  { key: "signing", title: "Подписание" },
  { key: "active", title: "Активна" },
];

export const deals: Deal[] = [
  { id: "R-1051", client: "Анна Полякова", amount: 120000, months: 12, stage: "new", status: "Новая", statusTone: "blue", nextStep: "Ответить сегодня", manager: "АС" },
  { id: "R-1052", client: "Роман Ветров", amount: 85000, months: 10, stage: "new", status: "Новая", statusTone: "blue", nextStep: "Заявка 30 мин назад", manager: "МК" },
  { id: "R-1053", client: "Ольга Смирнова", amount: 64000, months: 6, stage: "new", status: "Новая", statusTone: "blue", nextStep: "Уточнить сумму", manager: "АС" },
  { id: "R-1054", client: "Игорь Лапин", amount: 150000, months: 18, stage: "new", status: "Новая", statusTone: "blue", nextStep: "Перезвонить завтра", manager: "ДС" },
  { id: "R-1045", client: "Виктор Данилов", amount: 240000, months: 18, stage: "check", status: "Документы", statusTone: "yellow", nextStep: "Ждём паспорт", manager: "АС" },
  { id: "R-1046", client: "Елена Крылова", amount: 74000, months: 8, stage: "check", status: "Скоринг", statusTone: "yellow", nextStep: "Срок сегодня", urgent: true, manager: "ДС" },
  { id: "R-1047", client: "Павел Козлов", amount: 96000, months: 12, stage: "check", status: "Документы", statusTone: "yellow", nextStep: "Проверить ИНН", manager: "МК" },
  { id: "R-1017", client: "Сергей Миронов", amount: 58500, months: 6, stage: "signing", status: "Отправлен договор", statusTone: "blue", nextStep: "Подписать до 6 авг", deadline: "6 августа", manager: "МК" },
  { id: "R-1044", client: "Дарья Ильина", amount: 132000, months: 12, stage: "signing", status: "Согласование", statusTone: "blue", nextStep: "Созвон в 15:00", manager: "АС" },
  { id: "R-1042", client: "Марина Котова", amount: 96000, months: 12, stage: "active", status: "В графике", statusTone: "green", nextStep: "Оплата сегодня", manager: "АС" },
  { id: "R-1038", client: "Никита Абрамов", amount: 142000, months: 14, stage: "active", status: "В графике", statusTone: "green", nextStep: "Платёж 9 августа", manager: "ДС" },
  { id: "R-1031", client: "Татьяна Горина", amount: 88000, months: 10, stage: "active", status: "Просрочка 2 дня", statusTone: "red", nextStep: "Нужен новый график", urgent: true, manager: "МК" },
];

// Сколько платежей уже прошло — только у активных сделок
export const paidPayments: Record<string, number> = {
  "R-1042": 5,
  "R-1038": 3,
  "R-1031": 2,
};

// Персональные ссылки клиентов: токен → номер сделки.
// В реальной системе токен генерируется случайно при создании сделки.
export const clientTokens: Record<string, string> = Object.fromEntries(
  deals.map((d) => {
    // Детерминированный «случайный» токен из id сделки
    let h = 7;
    for (const ch of d.id) h = (h * 31 + ch.charCodeAt(0)) % 46656;
    return [`${d.id.slice(2).toLowerCase()}-${h.toString(36).padStart(3, "0")}`, d.id];
  })
);

export const tokenByDeal = (dealId: string) =>
  Object.keys(clientTokens).find((t) => clientTokens[t] === dealId) ?? "";

export interface Client {
  id: string;
  name: string;
  phone: string;
  status: "active" | "overdue" | "closed" | "lead";
  statusLabel: string;
  deals: number;
  portfolio: number;
  nextAction: string;
  nextDate: string;
}

export const clients: Client[] = [
  { id: "C-101", name: "Марина Котова", phone: "+7 921 402-18-55", status: "active", statusLabel: "В графике", deals: 1, portfolio: 96000, nextAction: "Платёж 18 000 ₽", nextDate: "Сегодня" },
  { id: "C-102", name: "Никита Абрамов", phone: "+7 911 733-02-14", status: "active", statusLabel: "В графике", deals: 2, portfolio: 142000, nextAction: "Платёж 12 000 ₽", nextDate: "9 августа" },
  { id: "C-103", name: "Татьяна Горина", phone: "+7 981 220-47-90", status: "overdue", statusLabel: "Просрочка 2 дня", deals: 1, portfolio: 88000, nextAction: "Звонок о графике", nextDate: "Сегодня" },
  { id: "C-104", name: "Дмитрий Савельев", phone: "+7 921 118-64-32", status: "active", statusLabel: "В графике", deals: 1, portfolio: 75000, nextAction: "Напомнить об оплате", nextDate: "Сегодня" },
  { id: "C-105", name: "Виктор Данилов", phone: "+7 911 604-77-21", status: "lead", statusLabel: "Проверка", deals: 1, portfolio: 240000, nextAction: "Дослать паспорт", nextDate: "6 августа" },
  { id: "C-106", name: "Анна Полякова", phone: "+7 981 355-90-08", status: "lead", statusLabel: "Новая заявка", deals: 1, portfolio: 120000, nextAction: "Первичный звонок", nextDate: "Сегодня" },
  { id: "C-107", name: "Сергей Миронов", phone: "+7 921 909-33-46", status: "lead", statusLabel: "Подписание", deals: 1, portfolio: 58500, nextAction: "Подписание договора", nextDate: "6 августа" },
  { id: "C-108", name: "Елена Крылова", phone: "+7 911 287-15-73", status: "lead", statusLabel: "Скоринг", deals: 1, portfolio: 74000, nextAction: "Решение по скорингу", nextDate: "Сегодня" },
  { id: "C-109", name: "Ирина Волкова", phone: "+7 981 512-38-27", status: "closed", statusLabel: "Закрыта", deals: 1, portfolio: 0, nextAction: "—", nextDate: "—" },
  { id: "C-110", name: "Олег Чернов", phone: "+7 921 774-51-19", status: "closed", statusLabel: "Закрыта", deals: 2, portfolio: 0, nextAction: "—", nextDate: "—" },
];

export interface PaymentHistoryItem {
  date: string;
  amount: number;
  status: "paid" | "due" | "overdue";
}

export const clientDetail = {
  id: "C-101",
  name: "Марина Котова",
  phone: "+7 921 402-18-55",
  email: "m.kotova@mail.ru",
  since: "марта 2026",
  deals: [
    { id: "R-1042", amount: 96000, paid: 40000, months: 12, monthly: 8000, status: "В графике" },
  ],
  history: [
    { date: "5 августа", amount: 8000, status: "due" },
    { date: "5 июля", amount: 8000, status: "paid" },
    { date: "5 июня", amount: 8000, status: "paid" },
    { date: "5 мая", amount: 8000, status: "paid" },
    { date: "5 апреля", amount: 8000, status: "paid" },
    { date: "5 марта", amount: 8000, status: "paid" },
  ] as PaymentHistoryItem[],
  nextAction: "Принять платёж 8 000 ₽ сегодня до 18:00",
};

// Календарь платежей: август 2026 (1 августа — суббота)
export interface CalendarDay {
  day: number;
  payments?: { count: number; sum: number };
  event?: { label: string; tone: "red" };
}

export const calendarDays: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  const map: Record<number, Partial<CalendarDay>> = {
    3: { payments: { count: 2, sum: 26500 } },
    5: { payments: { count: 7, sum: 96500 } },
    6: { event: { label: "Подписание R-1017", tone: "red" } },
    9: { payments: { count: 2, sum: 24000 } },
    11: { payments: { count: 3, sum: 34200 } },
    14: { payments: { count: 4, sum: 51600 } },
    18: { payments: { count: 2, sum: 19800 } },
    21: { payments: { count: 3, sum: 41000 } },
    25: { payments: { count: 5, sum: 63400 } },
    28: { payments: { count: 2, sum: 22500 } },
  };
  return { day, ...map[day] };
});

export const todayAgenda = {
  sum: 96500,
  items: [
    { time: "10:00", kind: "Звонок", text: "Татьяна Горина — новый график", urgent: true },
    { time: "12:00", kind: "Платёж", text: "Марина Котова — 18 000 ₽" },
    { time: "13:30", kind: "Платёж", text: "Дмитрий Савельев — 12 500 ₽" },
    { time: "15:00", kind: "Созвон", text: "Дарья Ильина — согласование" },
    { time: "17:00", kind: "Дедлайн", text: "Елена Крылова — решение по скорингу", urgent: true },
    { time: "18:00", kind: "Платёж", text: "Остальные оплаты дня — 66 000 ₽" },
  ],
};

export const kpi = {
  dueToday: { value: 96500, note: "7 платежей до 18:00" },
  portfolio: { value: 4820000, note: "↑ 12,4% к июлю" },
  overdue: { value: 73500, note: "6 сделок требуют контакта" },
  activeClients: { value: 184, note: "+16 за текущий месяц" },
};

export const priorities = [
  { name: "Марина Котова", reason: "Оплата сегодня · R-1042", amount: 18000, tone: "blue" as const },
  { name: "Дмитрий Савельев", reason: "Напомнить об оплате", amount: 12500, tone: "yellow" as const },
  { name: "Татьяна Горина", reason: "Просрочка 2 дня", amount: 12300, tone: "red" as const },
  { name: "Елена Крылова", reason: "Скоринг — срок сегодня", amount: 74000, tone: "red" as const },
];

export const newRequests = [
  { name: "Анна Полякова", text: "Запрос на 120 000 ₽" },
  { name: "Роман Ветров", text: "Запрос на 85 000 ₽" },
  { name: "Ольга Смирнова", text: "Запрос на 64 000 ₽" },
];

export const deadlines = [
  { title: "Договор R-1017", text: "Подписание до 6 августа", badge: "1 день", tone: "red" as const },
  { title: "Договор R-1031", text: "Нужен новый график платежей", badge: "Сегодня", tone: "red" as const },
  { title: "Договор R-1046", text: "Решение по скорингу", badge: "Сегодня", tone: "red" as const },
];

// План поступлений за август: факт до 5-го, дальше план
export const inflowChart = [
  { d: 1, v: 12 }, { d: 2, v: 18 }, { d: 3, v: 42 }, { d: 4, v: 48 }, { d: 5, v: 96 },
  { d: 7, v: 60 }, { d: 9, v: 84 }, { d: 11, v: 118 }, { d: 13, v: 104 }, { d: 15, v: 96 },
  { d: 17, v: 110 }, { d: 19, v: 128 }, { d: 21, v: 150 }, { d: 23, v: 138 }, { d: 25, v: 172 },
  { d: 27, v: 160 }, { d: 29, v: 176 }, { d: 31, v: 208 },
];
