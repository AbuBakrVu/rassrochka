// Моковые данные CRM «Nasiya» — учёт рассрочек. Сегодня 5 августа 2026 г.

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

// Этап автоматической лесенки напоминаний — считается от даты ближайшего
// неоплаченного взноса, не хранится отдельно на сделке.
export type ReminderStage = "before" | "due" | "overdue_soft" | "overdue_hard";

export const REMINDER_STAGE_LABEL: Record<ReminderStage, string> = {
  before: "Заранее",
  due: "Сегодня платёж",
  overdue_soft: "Просрочка 1–3 дня",
  overdue_hard: "Просрочка от 4 дней",
};

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
  manager: string; // инициалы для показа на карточках, напр. "АС"
  managerId?: number | null; // связь с users.id: инициалы не уникальны
  markupPct: number; // реальная наценка сделки в %, введённая при создании
  portalToken: string; // случайный токен для /pay/<token> — из deals.portal_token
  description?: string;
  category?: string;
  city?: string;
  guarantors: DealGuarantor[];
  /** Реструктуризация — months уже равен paid + restructuredMonths, если она была. */
  originalMonths?: number;
  restructuredMonths?: number;
  restructuredFrom?: string;
  downPayment?: number;
  /** Свой шаблон напоминания на эту сделку — если не задан, используется общий по умолчанию. */
  reminderTemplateId?: string;
  /** Последняя стадия лесенки напоминаний, отправленная по текущему взносу — вместе с датой взноса не даёт слать её повторно. */
  lastReminderStage?: ReminderStage;
  lastReminderDueDate?: string;
}

export interface DealGuarantor {
  id: string;
  name: string;
}

export const stages: { key: DealStage; title: string }[] = [
  { key: "new", title: "Новая заявка" },
  { key: "check", title: "Проверка" },
  { key: "signing", title: "Подписание" },
  { key: "active", title: "Активна" },
];

// У закрытых сделок выплачены все платежи
export const paidCount = (d: Deal, paidPayments: Record<string, number>) =>
  d.stage === "closed" ? d.months : (paidPayments[d.id] ?? 0);

// Наценка считается на закупочную цену, а не на сумму сделки: если товар
// стоит 10 000 и наценка 20%, клиент платит 12 000 (10 000 + 20% от 10 000).
// amount — это уже готовая сумма с наценкой, поэтому закупочную восстанавливаем
// делением, а не вычитанием процента из amount. Та же формула — на сервере,
// в lib/queries.ts::purchasePriceFromAmount (дублируется намеренно: там она
// нужна и вне контекста Deal, для accrueCoinvestorProfit).
export const purchasePrice = (amount: number, markupPct: number) =>
  Math.round(amount / (1 + markupPct / 100));

export const dealMargin = (amount: number, markupPct: number) =>
  amount - purchasePrice(amount, markupPct);

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

export interface NotificationItem {
  key: string;
  dealId: string;
  clientId: string;
  kind: RouteKind;
  title: string;
  text: string;
  time: string;
}

const notificationTitles: Record<RouteKind, string> = {
  overdue: "Просрочка платежа",
  deadline: "Приближается дедлайн",
  review: "Сделка на проверке",
  request: "Новая заявка",
};

// Не настоящие метки времени (у сделок нет event-лога) — просто
// правдоподобная лесенка «свежее выше», по порядку приоритета маршрута.
const notificationTimes = [
  "5 минут назад",
  "32 минуты назад",
  "1 час назад",
  "3 часа назад",
  "Вчера",
  "2 дня назад",
];

// Уведомления в шапке — тот же приоритизированный список, что и маршрут
// менеджера, просто оформленный как лента событий, а не список дел.
export function buildNotifications(deals: Deal[]): NotificationItem[] {
  return buildRoute(deals)
    .slice(0, 6)
    .map((item, i) => ({
      key: item.key,
      dealId: item.dealId,
      clientId: item.clientId,
      kind: item.kind,
      title: notificationTitles[item.kind],
      text: `${item.clientName} — ${item.text}`,
      time: notificationTimes[i] ?? "Ранее",
    }));
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
  /** Сделка, к которой относится nextAction — по ней открывается кнопка «Выполнить». */
  nextDealId?: string;
  middleName?: string;
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: string;
  registrationAddress?: string;
  livingAddress?: string;
  inn?: string;
  /** Заносится вручную менеджером — клиент долго не платит по рассрочке. */
  blacklistedAt?: string;
  blacklistReason?: string;
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

// Сотрудники: id — те же инициалы, что уже жили в Deal.manager,
// чтобы не заводить отдельную схему связи и не трогать сид-сделки.
export interface Employee {
  id: string; // "АС"
  name: string;
  role: string;
  phone: string;
  email: string;
  since: string;
}

export const seedEmployees: Employee[] = [
  {
    id: "АС",
    name: "Алексей Соколов",
    role: "Старший менеджер",
    phone: "+7 921 500-10-20",
    email: "a.sokolov@nasiya.ru",
    since: "января 2025",
  },
  {
    id: "МК",
    name: "Мария Кузнецова",
    role: "Менеджер по продажам",
    phone: "+7 911 500-20-30",
    email: "m.kuznetsova@nasiya.ru",
    since: "июня 2025",
  },
  {
    id: "ДС",
    name: "Дмитрий Соловьёв",
    role: "Менеджер по продажам",
    phone: "+7 981 500-30-40",
    email: "d.solovyov@nasiya.ru",
    since: "марта 2026",
  },
];

export const employeeById = (employees: Employee[], id: string) =>
  employees.find((e) => e.id === id);
