// Моковые данные CRM «Финора» — учёт рассрочек. Сегодня 5 августа 2026 г.

export const fmt = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₽";

// Этап в канбане; closed и rejected в канбан не попадают
export type DealStage =
  | "new"
  | "check"
  | "signing"
  | "active"
  | "closed"
  | "rejected";

// Состояние для карточки клиента
export type DealState = "active" | "closed" | "rejected" | "pending";

export interface Deal {
  id: string;
  clientId: string;
  client: string;
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  stage: DealStage;
  status: string;
  statusTone: "blue" | "yellow" | "green" | "red" | "gray";
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

// Затравочные данные — стартовое состояние клиентского стора (см. lib/store.tsx).
// Сам по себе этот массив больше нигде не читается напрямую.
export const seedDeals: Deal[] = [
  // Новые заявки
  { id: "R-1051", clientId: "C-106", client: "Анна Полякова", product: "MacBook Air 13″ M3", amount: 120000, months: 12, openedAt: "2026-08-05", stage: "new", status: "Новая", statusTone: "blue", nextStep: "Ответить сегодня", manager: "АС" },
  { id: "R-1052", clientId: "C-111", client: "Роман Ветров", product: "Велосипед Merida Big Nine", amount: 85000, months: 10, openedAt: "2026-08-05", stage: "new", status: "Новая", statusTone: "blue", nextStep: "Заявка 30 мин назад", manager: "МК" },
  { id: "R-1053", clientId: "C-112", client: "Ольга Смирнова", product: "Стиральная машина Bosch", amount: 64000, months: 6, openedAt: "2026-08-04", stage: "new", status: "Новая", statusTone: "blue", nextStep: "Уточнить сумму", manager: "АС" },
  { id: "R-1054", clientId: "C-113", client: "Игорь Лапин", product: "Кухонный гарнитур на заказ", amount: 150000, months: 18, openedAt: "2026-08-04", stage: "new", status: "Новая", statusTone: "blue", nextStep: "Перезвонить завтра", manager: "ДС" },
  // Проверка
  { id: "R-1045", clientId: "C-105", client: "Виктор Данилов", product: "Автоприцеп МЗСА", amount: 240000, months: 18, openedAt: "2026-08-01", stage: "check", status: "Документы", statusTone: "yellow", nextStep: "Ждём паспорт", manager: "АС" },
  { id: "R-1046", clientId: "C-108", client: "Елена Крылова", product: "iPhone 15 Pro 256 ГБ", amount: 74000, months: 8, openedAt: "2026-07-31", stage: "check", status: "Скоринг", statusTone: "yellow", nextStep: "Срок сегодня", urgent: true, manager: "ДС" },
  { id: "R-1047", clientId: "C-114", client: "Павел Козлов", product: "Телевизор LG OLED 55″", amount: 96000, months: 12, openedAt: "2026-07-30", stage: "check", status: "Документы", statusTone: "yellow", nextStep: "Проверить ИНН", manager: "МК" },
  // Подписание
  { id: "R-1017", clientId: "C-107", client: "Сергей Миронов", product: "Ноутбук ASUS Vivobook 16", amount: 58500, months: 6, openedAt: "2026-07-28", stage: "signing", status: "Отправлен договор", statusTone: "blue", nextStep: "Подписать до 6 авг", deadline: "6 августа", manager: "МК" },
  { id: "R-1044", clientId: "C-115", client: "Дарья Ильина", product: "Диван Bergen + кресло", amount: 132000, months: 12, openedAt: "2026-07-27", stage: "signing", status: "Согласование", statusTone: "blue", nextStep: "Созвон в 15:00", manager: "АС" },
  // Активные
  { id: "R-1042", clientId: "C-101", client: "Марина Котова", product: "iPhone 15 Pro Max 256 ГБ", amount: 96000, months: 12, openedAt: "2026-03-05", stage: "active", status: "В графике", statusTone: "green", nextStep: "Оплата сегодня", manager: "АС" },
  { id: "R-1038", clientId: "C-102", client: "Никита Абрамов", product: "Холодильник Bosch Serie 6", amount: 142000, months: 14, openedAt: "2026-04-05", stage: "active", status: "В графике", statusTone: "green", nextStep: "Платёж 9 августа", manager: "ДС" },
  { id: "R-1031", clientId: "C-103", client: "Татьяна Горина", product: "Мебель для спальни", amount: 88000, months: 10, openedAt: "2026-05-05", stage: "active", status: "Просрочка 2 дня", statusTone: "red", nextStep: "Нужен новый график", urgent: true, manager: "МК" },
  { id: "R-1040", clientId: "C-104", client: "Дмитрий Савельев", product: "Ноутбук Lenovo IdeaPad", amount: 75000, months: 10, openedAt: "2026-03-20", stage: "active", status: "В графике", statusTone: "green", nextStep: "Напомнить об оплате", manager: "АС" },
  // Закрытые
  { id: "R-0988", clientId: "C-101", client: "Марина Котова", product: "Samsung Galaxy A55", amount: 48000, months: 6, openedAt: "2025-09-05", stage: "closed", status: "Закрыта", statusTone: "gray", nextStep: "Выплачена полностью", manager: "АС" },
  { id: "R-0975", clientId: "C-102", client: "Никита Абрамов", product: "Стиральная машина LG", amount: 64000, months: 8, openedAt: "2025-06-05", stage: "closed", status: "Закрыта", statusTone: "gray", nextStep: "Выплачена полностью", manager: "ДС" },
  { id: "R-0961", clientId: "C-109", client: "Ирина Волкова", product: "Кухонный гарнитур", amount: 55000, months: 6, openedAt: "2025-08-05", stage: "closed", status: "Закрыта", statusTone: "gray", nextStep: "Выплачена полностью", manager: "МК" },
  { id: "R-0954", clientId: "C-110", client: "Олег Чернов", product: "Телевизор Samsung 55″", amount: 39000, months: 4, openedAt: "2025-10-05", stage: "closed", status: "Закрыта", statusTone: "gray", nextStep: "Выплачена полностью", manager: "АС" },
  { id: "R-0942", clientId: "C-110", client: "Олег Чернов", product: "Ноутбук HP Pavilion", amount: 72000, months: 9, openedAt: "2025-04-05", stage: "closed", status: "Закрыта", statusTone: "gray", nextStep: "Выплачена полностью", manager: "АС" },
  // Отклонённые
  { id: "R-1012", clientId: "C-103", client: "Татьяна Горина", product: "Автомобиль Kia Rio", amount: 320000, months: 24, openedAt: "2026-02-14", stage: "rejected", status: "Отклонена", statusTone: "red", nextStep: "Отказ: высокая нагрузка", manager: "МК" },
  { id: "R-1029", clientId: "C-105", client: "Виктор Данилов", product: "Мотоцикл Bajaj", amount: 210000, months: 18, openedAt: "2026-04-22", stage: "rejected", status: "Отклонена", statusTone: "red", nextStep: "Отказ: нет подтверждения дохода", manager: "АС" },
  { id: "R-0930", clientId: "C-109", client: "Ирина Волкова", product: "Смартфон Xiaomi 14", amount: 62000, months: 8, openedAt: "2025-03-11", stage: "rejected", status: "Отклонена", statusTone: "red", nextStep: "Отказ: клиент передумал", manager: "ДС" },
];

// Сколько платежей уже прошло у активных сделок — тоже затравка для стора
export const seedPaidPayments: Record<string, number> = {
  "R-1042": 5,
  "R-1038": 3,
  "R-1031": 2,
  "R-1040": 4,
};

// У закрытых сделок выплачены все платежи
export const paidCount = (d: Deal, paidPayments: Record<string, number>) =>
  d.stage === "closed" ? d.months : (paidPayments[d.id] ?? 0);

export const dealState = (d: Deal): DealState =>
  d.stage === "active" || d.stage === "closed" || d.stage === "rejected"
    ? d.stage
    : "pending";

export const dealsOfClient = (deals: Deal[], clientId: string) =>
  deals.filter((d) => d.clientId === clientId);

// Русское склонение по числу: 1 сделка / 2 сделки / 5 сделок
export const ruPlural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

export type RiskTone = "green" | "yellow" | "red";

export interface RiskAssessment {
  score: number; // 0–100, выше — надёжнее
  tone: RiskTone;
  label: string;
  reasons: { text: string; positive: boolean }[];
}

// Простая прозрачная скоринговая модель: каждый фактор виден в reasons,
// решение не должно выглядеть чёрным ящиком для менеджера.
export function assessRisk(deals: Deal[], clientId: string): RiskAssessment {
  const list = dealsOfClient(deals, clientId);
  const closed = list.filter((d) => d.stage === "closed").length;
  const rejected = list.filter((d) => d.stage === "rejected").length;
  const activeOverdue = list.filter(
    (d) => d.stage === "active" && d.statusTone === "red"
  ).length;
  const activeOk = list.filter(
    (d) => d.stage === "active" && d.statusTone !== "red"
  ).length;

  const reasons: RiskAssessment["reasons"] = [];
  let score = 70;

  if (list.length === 0) {
    return {
      score: 55,
      tone: "yellow",
      label: "Недостаточно истории",
      reasons: [
        { text: "У клиента ещё не было сделок", positive: false },
      ],
    };
  }

  if (closed > 0) {
    score += Math.min(closed * 8, 24);
    reasons.push({
      text: `${closed} ${ruPlural(closed, "закрытая сделка", "закрытые сделки", "закрытых сделок")} выплачено полностью`,
      positive: true,
    });
  }
  if (activeOk > 0) {
    score += 5;
    reasons.push({
      text: `${activeOk} ${ruPlural(activeOk, "активная сделка", "активные сделки", "активных сделок")} без просрочек`,
      positive: true,
    });
  }
  if (activeOverdue > 0) {
    score -= 25;
    reasons.push({
      text: "Есть просрочка по действующей сделке",
      positive: false,
    });
  }
  if (rejected > 0) {
    score -= rejected * 12;
    reasons.push({
      text: `${rejected} ${ruPlural(rejected, "отклонённая заявка", "отклонённые заявки", "отклонённых заявок")} в прошлом`,
      positive: false,
    });
  }

  score = Math.max(5, Math.min(98, Math.round(score)));
  const tone: RiskTone = score >= 75 ? "green" : score >= 50 ? "yellow" : "red";
  const label =
    tone === "green"
      ? "Надёжный клиент"
      : tone === "yellow"
        ? "Стандартный риск"
        : "Повышенный риск";

  return { score, tone, label, reasons };
}

// Персональная ссылка клиента: детерминированный «случайный» токен из id сделки.
// В реальной системе он генерировался бы случайно при создании сделки и
// хранился бы отдельно — здесь достаточно чистой функции от id.
export const tokenForDeal = (dealId: string) => {
  let h = 7;
  for (const ch of dealId) h = (h * 31 + ch.charCodeAt(0)) % 46656;
  return `${dealId.slice(2).toLowerCase()}-${h.toString(36).padStart(3, "0")}`;
};

export const dealIdFromToken = (deals: Deal[], token: string) =>
  deals.find((d) => tokenForDeal(d.id) === token)?.id;

export type RouteKind = "overdue" | "deadline" | "review" | "request";

export interface RouteItem {
  key: string;
  dealId: string;
  clientId: string;
  clientName: string;
  kind: RouteKind;
  text: string;
  amount: number;
  priority: number;
}

// Маршрут менеджера на сегодня: объединяет всё, что требует действия,
// в один приоритизированный список — из тех же данных о сделках,
// без отдельного источника правды.
export function buildRoute(deals: Deal[]): RouteItem[] {
  const items: RouteItem[] = [];

  for (const d of deals) {
    if (d.stage === "closed" || d.stage === "rejected") continue;

    if (d.stage === "active") {
      if (d.statusTone === "red" || d.urgent) {
        items.push({
          key: d.id,
          dealId: d.id,
          clientId: d.clientId,
          clientName: d.client,
          kind: "overdue",
          text: d.nextStep,
          amount: Math.round(d.amount / d.months),
          priority: 100,
        });
      }
      continue;
    }

    if (d.stage === "signing") {
      items.push({
        key: d.id,
        dealId: d.id,
        clientId: d.clientId,
        clientName: d.client,
        kind: "deadline",
        text: d.nextStep,
        amount: d.amount,
        priority: d.urgent ? 95 : 80,
      });
      continue;
    }

    if (d.stage === "check") {
      items.push({
        key: d.id,
        dealId: d.id,
        clientId: d.clientId,
        clientName: d.client,
        kind: d.urgent ? "deadline" : "review",
        text: d.nextStep,
        amount: d.amount,
        priority: d.urgent ? 90 : 55,
      });
      continue;
    }

    if (d.stage === "new") {
      items.push({
        key: d.id,
        dealId: d.id,
        clientId: d.clientId,
        clientName: d.client,
        kind: "request",
        text: d.nextStep,
        amount: d.amount,
        priority: 40,
      });
    }
  }

  return items.sort((a, b) => b.priority - a.priority);
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  since: string;
  status: "active" | "overdue" | "closed" | "lead";
  statusLabel: string;
  nextAction: string;
  nextDate: string;
}

// Затравочные данные — стартовое состояние клиентского стора (см. lib/store.tsx).
export const seedClients: Client[] = [
  { id: "C-101", name: "Марина Котова", phone: "+7 921 402-18-55", email: "m.kotova@mail.ru", city: "Санкт-Петербург", since: "сентября 2025", status: "active", statusLabel: "В графике", nextAction: "Платёж 8 000 ₽", nextDate: "Сегодня" },
  { id: "C-102", name: "Никита Абрамов", phone: "+7 911 733-02-14", email: "n.abramov@gmail.com", city: "Санкт-Петербург", since: "июня 2025", status: "active", statusLabel: "В графике", nextAction: "Платёж 10 143 ₽", nextDate: "9 августа" },
  { id: "C-103", name: "Татьяна Горина", phone: "+7 981 220-47-90", email: "gorina.t@yandex.ru", city: "Москва", since: "февраля 2026", status: "overdue", statusLabel: "Просрочка 2 дня", nextAction: "Звонок о новом графике", nextDate: "Сегодня" },
  { id: "C-104", name: "Дмитрий Савельев", phone: "+7 921 118-64-32", email: "savelev.d@mail.ru", city: "Казань", since: "марта 2026", status: "active", statusLabel: "В графике", nextAction: "Напомнить об оплате", nextDate: "Сегодня" },
  { id: "C-105", name: "Виктор Данилов", phone: "+7 911 604-77-21", email: "v.danilov@gmail.com", city: "Екатеринбург", since: "апреля 2026", status: "lead", statusLabel: "Проверка", nextAction: "Дослать паспорт", nextDate: "6 августа" },
  { id: "C-106", name: "Анна Полякова", phone: "+7 981 355-90-08", email: "a.polyakova@mail.ru", city: "Москва", since: "августа 2026", status: "lead", statusLabel: "Новая заявка", nextAction: "Первичный звонок", nextDate: "Сегодня" },
  { id: "C-107", name: "Сергей Миронов", phone: "+7 921 909-33-46", email: "s.mironov@yandex.ru", city: "Новосибирск", since: "июля 2026", status: "lead", statusLabel: "Подписание", nextAction: "Подписание договора", nextDate: "6 августа" },
  { id: "C-108", name: "Елена Крылова", phone: "+7 911 287-15-73", email: "e.krylova@gmail.com", city: "Краснодар", since: "июля 2026", status: "lead", statusLabel: "Скоринг", nextAction: "Решение по скорингу", nextDate: "Сегодня" },
  { id: "C-109", name: "Ирина Волкова", phone: "+7 981 512-38-27", email: "i.volkova@mail.ru", city: "Москва", since: "марта 2025", status: "closed", statusLabel: "Закрыта", nextAction: "—", nextDate: "—" },
  { id: "C-110", name: "Олег Чернов", phone: "+7 921 774-51-19", email: "o.chernov@yandex.ru", city: "Казань", since: "апреля 2025", status: "closed", statusLabel: "Закрыта", nextAction: "—", nextDate: "—" },
  { id: "C-111", name: "Роман Ветров", phone: "+7 911 845-20-63", email: "r.vetrov@gmail.com", city: "Санкт-Петербург", since: "августа 2026", status: "lead", statusLabel: "Новая заявка", nextAction: "Первичный звонок", nextDate: "Сегодня" },
  { id: "C-112", name: "Ольга Смирнова", phone: "+7 981 067-92-14", email: "o.smirnova@mail.ru", city: "Москва", since: "августа 2026", status: "lead", statusLabel: "Новая заявка", nextAction: "Уточнить сумму", nextDate: "6 августа" },
  { id: "C-113", name: "Игорь Лапин", phone: "+7 921 330-58-47", email: "i.lapin@yandex.ru", city: "Екатеринбург", since: "августа 2026", status: "lead", statusLabel: "Новая заявка", nextAction: "Перезвонить", nextDate: "6 августа" },
  { id: "C-114", name: "Павел Козлов", phone: "+7 911 452-77-08", email: "p.kozlov@gmail.com", city: "Новосибирск", since: "июля 2026", status: "lead", statusLabel: "Проверка", nextAction: "Проверить ИНН", nextDate: "7 августа" },
  { id: "C-115", name: "Дарья Ильина", phone: "+7 981 619-04-25", email: "d.ilina@mail.ru", city: "Краснодар", since: "июля 2026", status: "lead", statusLabel: "Подписание", nextAction: "Созвон в 15:00", nextDate: "Сегодня" },
];

export const clientById = (clients: Client[], id: string) =>
  clients.find((c) => c.id === id);

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
