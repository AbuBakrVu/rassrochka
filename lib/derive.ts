// Производные расчёты для дашборда и календаря платежей.
// Всё считается из deals/clients/paidPayments стора — никаких
// декоративных моков: создали сделку или приняли платёж — цифры меняются.

import {
  paidCount,
  buildRoute,
  fmt,
  type Deal,
  type Client,
  type RouteItem,
} from "./data";
import type { Employee } from "./store";
import { buildSchedule, type Installment } from "./schedule";

// Именительный падеж для заголовка календаря («Август 2026») — monthNames
// в lib/schedule.ts родительный («6 августа») и сюда не подходит.
const NOMINATIVE_MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
import { todayIso } from "./status";

// «Сегодня» — настоящее. До этапа 3 здесь стояла зафиксированная дата
// "2026-08-05", потому что все данные были моками, построенными вокруг неё.
export { todayIso } from "./status";

export interface DealComputed {
  deal: Deal;
  paid: number;
  schedule: Installment[];
  paidSum: number;
  remaining: number;
  next?: Installment;
}

export function computeActive(
  deals: Deal[],
  paidPayments: Record<string, number>
): DealComputed[] {
  return deals
    .filter((d) => d.stage === "active")
    .map((deal) => {
      const paid = paidCount(deal, paidPayments);
      const schedule = buildSchedule(
        deal.amount,
        deal.months,
        paid,
        deal.openedAt
      );
      const paidSum = schedule
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);
      return {
        deal,
        paid,
        schedule,
        paidSum,
        remaining: deal.amount - paidSum,
        next: schedule.find((p) => p.status === "due"),
      };
    });
}

// ── Главная ────────────────────────────────────────────────────────────

export interface DashboardData {
  dueToday: { sum: number; count: number };
  portfolio: number;
  overdue: { sum: number; count: number };
  activeClients: number;
  priorities: RouteItem[];
  newRequests: { dealId: string; name: string; text: string }[];
  deadlines: { dealId: string; title: string; text: string; badge: string }[];
  inflow: { day: number; sum: number }[];
  inflowTotal: number;
}

export function computeDashboard(
  deals: Deal[],
  clients: Client[],
  paidPayments: Record<string, number>
): DashboardData {
  const today = todayIso();
  const active = computeActive(deals, paidPayments);

  const dueTodayList = active.filter((c) => c.next?.iso === today);
  const overdueList = active.filter((c) => c.deal.statusTone === "red");

  const activeClientIds = new Set(active.map((c) => c.deal.clientId));

  const route = buildRoute(deals);

  const newRequests = deals
    .filter((d) => d.stage === "new")
    .slice(0, 3)
    .map((d) => ({
      dealId: d.id,
      name: d.client,
      text: `Запрос на ${fmt(d.amount)}`,
    }));

  const deadlines = route
    .filter((r) => r.kind === "deadline")
    .slice(0, 3)
    .map((r) => ({
      dealId: r.dealId,
      title: `Договор ${r.dealId}`,
      text: r.text,
      badge: "Скоро",
    }));

  // План поступлений: платежи активных сделок в августе 2026, накопительно
  const monthPrefix = today.slice(0, 7);
  const byDay = new Map<number, number>();
  for (const c of active) {
    for (const p of c.schedule) {
      if (p.iso.startsWith(monthPrefix)) {
        const day = Number(p.iso.slice(8));
        byDay.set(day, (byDay.get(day) ?? 0) + p.amount);
      }
    }
  }
  const inflow = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, sum]) => ({ day, sum }));
  const inflowTotal = inflow.reduce((s, p) => s + p.sum, 0);

  return {
    dueToday: {
      sum: dueTodayList.reduce((s, c) => s + (c.next?.amount ?? 0), 0),
      count: dueTodayList.length,
    },
    portfolio: active.reduce((s, c) => s + c.remaining, 0),
    overdue: {
      sum: overdueList.reduce((s, c) => s + (c.next?.amount ?? 0), 0),
      count: overdueList.length,
    },
    activeClients: activeClientIds.size,
    priorities: route.slice(0, 4),
    newRequests,
    deadlines,
    inflow,
    inflowTotal,
  };
}

// ── Платежи (календарь) ────────────────────────────────────────────────

export interface CalendarDayItem {
  dealId: string;
  clientName: string;
  product: string;
  amount: number;
}

export interface CalendarCell {
  day: number;
  iso: string;
  payments?: { count: number; sum: number };
  event?: { label: string };
  items: CalendarDayItem[];
}

export interface AgendaItem {
  dealId: string;
  time: string;
  kind: string;
  text: string;
  urgent?: boolean;
}

export interface CalendarData {
  cells: CalendarCell[];
  todaySum: number;
  agenda: AgendaItem[];
  /** «Август 2026» — заголовок текущего месяца, вычисленный из настоящей даты. */
  monthLabel: string;
  /** Сколько пустых ячеек нужно перед 1-м числом, чтобы неделя начиналась с понедельника. */
  leadDays: number;
  /** День месяца, соответствующий today — чем подсвечивать сегодняшнюю ячейку. */
  todayDay: number;
  todayIso: string;
  /** ISO-даты текущей недели (пн…вс) — для режима «Неделя». */
  weekDayIsos: string[];
}

const agendaTimes = ["10:00", "11:30", "12:00", "13:30", "15:00", "17:00"];

export function computeCalendar(
  deals: Deal[],
  paidPayments: Record<string, number>
): CalendarData {
  const today = todayIso();
  const active = computeActive(deals, paidPayments);
  const monthPrefix = today.slice(0, 7);
  const [year, month] = today.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDay = Number(today.slice(8));

  const byDay = new Map<number, { count: number; sum: number }>();
  const itemsByDay = new Map<number, CalendarDayItem[]>();
  for (const c of active) {
    for (const p of c.schedule) {
      if (p.iso.startsWith(monthPrefix)) {
        const day = Number(p.iso.slice(8));
        const cur = byDay.get(day) ?? { count: 0, sum: 0 };
        byDay.set(day, { count: cur.count + 1, sum: cur.sum + p.amount });
        const list = itemsByDay.get(day) ?? [];
        list.push({
          dealId: c.deal.id,
          clientName: c.deal.client,
          product: c.deal.product,
          amount: p.amount,
        });
        itemsByDay.set(day, list);
      }
    }
  }

  // События подписания: у сделок на этапе signing дедлайн вида «6 августа»
  const events = new Map<number, string>();
  for (const d of deals) {
    if (d.stage === "signing" && d.deadline) {
      const day = parseInt(d.deadline, 10);
      if (Number.isFinite(day)) events.set(day, `Подписание ${d.id}`);
    }
  }

  // Понедельник = 0 … воскресенье = 6, тогда как JS Date даёт 0 = воскресенье
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const cells: CalendarCell[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return {
      day,
      iso: `${monthPrefix}-${String(day).padStart(2, "0")}`,
      payments: byDay.get(day),
      event: events.has(day) ? { label: events.get(day)! } : undefined,
      items: itemsByDay.get(day) ?? [],
    };
  });

  // Повестка «Сегодня»: просрочки → платежи дня → дедлайны
  const route = buildRoute(deals);
  const agenda: AgendaItem[] = [];

  for (const r of route.filter((r) => r.kind === "overdue")) {
    agenda.push({
      dealId: r.dealId,
      time: "",
      kind: "Звонок",
      text: `${r.clientName} — ${r.text.toLowerCase()}`,
      urgent: true,
    });
  }
  for (const c of active) {
    if (c.next?.iso === today && c.deal.statusTone !== "red") {
      agenda.push({
        dealId: c.deal.id,
        time: "",
        kind: "Платёж",
        text: `${c.deal.client} — ${fmt(c.next.amount)}`,
      });
    }
  }
  for (const r of route.filter((r) => r.kind === "deadline").slice(0, 2)) {
    agenda.push({
      dealId: r.dealId,
      time: "",
      kind: "Дедлайн",
      text: `${r.clientName} — ${r.text.toLowerCase()}`,
      urgent: r.priority >= 90,
    });
  }
  agenda.forEach((a, i) => {
    a.time = agendaTimes[i] ?? "18:00";
  });

  const todaySum = active
    .filter((c) => c.next?.iso === today)
    .reduce((s, c) => s + (c.next?.amount ?? 0), 0);

  const monthLabel = `${NOMINATIVE_MONTHS[month - 1]} ${year}`;

  const todayWeekday = (new Date(year, month - 1, todayDay).getDay() + 6) % 7;
  const monday = new Date(year, month - 1, todayDay - todayWeekday);
  const weekDayIsos = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  return {
    cells,
    todaySum,
    agenda,
    monthLabel,
    leadDays: firstWeekday,
    todayDay,
    todayIso: today,
    weekDayIsos,
  };
}

// ── Лестница просрочки ────────────────────────────────────────────────

export interface AgingItem {
  dealId: string;
  clientName: string;
  daysLate: number;
  amount: number;
}

export interface AgingBucket {
  key: "1-7" | "8-30" | "30+";
  label: string;
  items: AgingItem[];
  sum: number;
}

const agingRanges: { key: AgingBucket["key"]; label: string; min: number; max: number }[] = [
  { key: "1-7", label: "1–7 дней", min: 1, max: 7 },
  { key: "8-30", label: "8–30 дней", min: 8, max: 30 },
  { key: "30+", label: "30+ дней", min: 31, max: Infinity },
];

// Просроченной считаем сделку по тому же признаку, что и везде в
// приложении (Главная, Маршрут, Сотрудники) — statusTone "red" на активном
// этапе, а не пересчитываем факт просрочки заново по датам графика: у
// мок-данных день следующего взноса иногда совпадал с «сегодня», из-за
// чего чисто дневной расчёт разошёлся бы с остальными разделами. Число
// дней просрочки при этом берём из графика, минимум 1 — для бакетинга.
export function computeAging(
  deals: Deal[],
  paidPayments: Record<string, number>
): AgingBucket[] {
  const active = computeActive(deals, paidPayments);
  const today = new Date(todayIso()).getTime();

  const items: AgingItem[] = [];
  for (const c of active) {
    if (!c.next || c.deal.statusTone !== "red") continue;
    const daysLate = Math.max(
      1,
      Math.round((today - new Date(c.next.iso).getTime()) / 86_400_000)
    );
    items.push({
      dealId: c.deal.id,
      clientName: c.deal.client,
      daysLate,
      amount: c.next.amount,
    });
  }

  return agingRanges.map((r) => {
    const list = items
      .filter((i) => i.daysLate >= r.min && i.daysLate <= r.max)
      .sort((a, b) => b.daysLate - a.daysLate);
    return {
      key: r.key,
      label: r.label,
      items: list,
      sum: list.reduce((s, i) => s + i.amount, 0),
    };
  });
}

// ── Сотрудники ─────────────────────────────────────────────────────────

export interface EmployeeStats {
  employee: Employee;
  total: number;
  active: number;
  overdue: number;
  newLeads: number;
  closed: number;
  rejected: number;
  portfolio: number; // остаток по активным сделкам этого сотрудника
  collected: number; // выплачено клиентами по его активным сделкам
  topItems: RouteItem[]; // 3 самых приоритетных дела из его книги
}

export function computeEmployees(
  employees: Employee[],
  deals: Deal[],
  paidPayments: Record<string, number>
): EmployeeStats[] {
  const route = buildRoute(deals);

  // Связываем по managerId, а не по инициалам: у двух сотрудников они
  // легко совпадут («Алексей Соколов» и «Анна Смирнова» оба дают «АС»)
  return employees.map((employee) => {
    const list = deals.filter((d) => d.managerId === employee.id);
    const active = computeActive(list, paidPayments);

    return {
      employee,
      total: list.length,
      active: active.length,
      overdue: active.filter((c) => c.deal.statusTone === "red").length,
      newLeads: list.filter((d) => d.stage === "new").length,
      closed: list.filter((d) => d.stage === "closed").length,
      rejected: list.filter((d) => d.stage === "rejected").length,
      portfolio: active.reduce((s, c) => s + c.remaining, 0),
      collected: active.reduce((s, c) => s + c.paidSum, 0),
      topItems: route
        .filter((r) => deals.find((x) => x.id === r.dealId)?.managerId === employee.id)
        .slice(0, 3),
    };
  });
}
