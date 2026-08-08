// Производные расчёты для дашборда и календаря платежей.
// Всё считается из deals/clients/paidPayments стора — никаких
// декоративных моков: создали сделку или приняли платёж — цифры меняются.

import {
  paidCount,
  buildRoute,
  fmt,
  seedEmployees,
  type Deal,
  type Client,
  type Employee,
  type RouteItem,
} from "./data";
import { buildSchedule, type Installment } from "./schedule";

// «Сегодня» приложения зафиксировано, как и во всех моках
export const TODAY_ISO = "2026-08-05";

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
  const active = computeActive(deals, paidPayments);

  const dueTodayList = active.filter((c) => c.next?.iso === TODAY_ISO);
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
  const monthPrefix = TODAY_ISO.slice(0, 7); // "2026-08"
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

export interface CalendarCell {
  day: number;
  payments?: { count: number; sum: number };
  event?: { label: string };
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
}

const agendaTimes = ["10:00", "11:30", "12:00", "13:30", "15:00", "17:00"];

export function computeCalendar(
  deals: Deal[],
  paidPayments: Record<string, number>
): CalendarData {
  const active = computeActive(deals, paidPayments);
  const monthPrefix = TODAY_ISO.slice(0, 7);

  const byDay = new Map<number, { count: number; sum: number }>();
  for (const c of active) {
    for (const p of c.schedule) {
      if (p.iso.startsWith(monthPrefix)) {
        const day = Number(p.iso.slice(8));
        const cur = byDay.get(day) ?? { count: 0, sum: 0 };
        byDay.set(day, { count: cur.count + 1, sum: cur.sum + p.amount });
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

  const cells: CalendarCell[] = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return {
      day,
      payments: byDay.get(day),
      event: events.has(day) ? { label: events.get(day)! } : undefined,
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
    if (c.next?.iso === TODAY_ISO && c.deal.statusTone !== "red") {
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
    .filter((c) => c.next?.iso === TODAY_ISO)
    .reduce((s, c) => s + (c.next?.amount ?? 0), 0);

  return { cells, todaySum, agenda };
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
  deals: Deal[],
  paidPayments: Record<string, number>
): EmployeeStats[] {
  const route = buildRoute(deals);

  return seedEmployees.map((employee) => {
    const list = deals.filter((d) => d.manager === employee.id);
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
      topItems: route.filter((r) => {
        const d = deals.find((x) => x.id === r.dealId);
        return d?.manager === employee.id;
      }).slice(0, 3),
    };
  });
}
