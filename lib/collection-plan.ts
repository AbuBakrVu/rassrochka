// План/факт сборов за месяц.
//
// План — взносы графиков с датой в этом месяце: по сделкам, которые сейчас
// активны, и по закрытым, деньги по которым приходили в этом месяце или
// позже (иначе сделка, досрочно закрытая в этом месяце, выпала бы из плана
// задним числом). Администратор может заменить план менеджера своей целью.
//
// Факт — деньги клиентов за месяц по кассе: платежи по взносам, частичные,
// досрочное погашение, за вычетом отмен; первоначальные взносы — нет, это
// выдача, а не сбор. Факт разложен на «в счёт плана месяца», «просрочка
// прошлых месяцев» и «вперёд» (взносы следующих месяцев и досрочное).
//
// Чистые функции: проверяются тестом lib/collection-plan.test.ts.

import type { Deal } from "./data";
import type { CashTx } from "./store";
import { scheduleForDeal } from "./schedule.ts";

export interface PlanFactRow {
  key: string;
  label: string;
  /** План по графикам. */
  auto: number;
  /** Цель, заданная вручную (только у менеджеров). */
  target?: number;
  /** План с учётом цели: target ?? auto. */
  plan: number;
  fact: number;
  /** Из факта: взносы с датой в этом месяце. */
  onPlan: number;
  /** Из факта: взносы прошлых месяцев. */
  arrears: number;
  /** Из факта: взносы следующих месяцев и досрочное погашение. */
  ahead: number;
  deals: number;
}

export interface PlanFact {
  month: string; // "2026-10"
  total: PlanFactRow;
  byManager: PlanFactRow[];
  byBranch: PlanFactRow[];
  /** Нарастающим итогом по дням месяца — для графика. */
  daily: { day: number; plan: number; fact: number }[];
}

const DOWN_PAYMENT = /^Первоначальный взнос/;

/** Платёж клиента в счёт долга (не первый взнос) — с отменами со знаком минус. */
export const isCollection = (t: CashTx) =>
  t.kind === "payment" && !(t.installmentNumber === undefined && DOWN_PAYMENT.test(t.title));

const emptyRow = (key: string, label: string): PlanFactRow => ({
  key, label, auto: 0, plan: 0, fact: 0, onPlan: 0, arrears: 0, ahead: 0, deals: 0,
});

export function computePlanFact(input: {
  month: string;
  deals: readonly Deal[];
  cash: readonly CashTx[];
  managers: readonly { id: number; name: string }[];
  branches: readonly { id: number; name: string }[];
  /** Цели по менеджерам на этот месяц: managerId → сумма. */
  targets: ReadonlyMap<number, number>;
}): PlanFact {
  const { month, deals, cash, managers, branches, targets } = input;
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

  const collections = cash.filter((t) => t.dealId && isCollection(t));
  const lastCollection = new Map<string, string>();
  for (const t of collections) {
    const prev = lastCollection.get(t.dealId!);
    if (!prev || t.date > prev) lastCollection.set(t.dealId!, t.date);
  }

  const total = emptyRow("total", "Компания");
  const byManager = new Map<string, PlanFactRow>();
  const byBranch = new Map<string, PlanFactRow>();
  const planByDay = new Array<number>(daysInMonth + 1).fill(0);
  const factByDay = new Array<number>(daysInMonth + 1).fill(0);

  const managerRow = (deal: Deal) => {
    const key = deal.managerId ? String(deal.managerId) : "none";
    let row = byManager.get(key);
    if (!row) {
      const name = managers.find((m) => m.id === deal.managerId)?.name ?? "Без ответственного";
      row = emptyRow(key, name);
      byManager.set(key, row);
    }
    return row;
  };
  const branchRow = (deal: Deal) => {
    const key = String(deal.branchId ?? 0);
    let row = byBranch.get(key);
    if (!row) {
      row = emptyRow(key, branches.find((b) => b.id === deal.branchId)?.name ?? "Без филиала");
      byBranch.set(key, row);
    }
    return row;
  };

  const dealById = new Map(deals.map((d) => [d.id, d]));
  const dueMonthOf = new Map<string, Map<number, string>>(); // сделка → взнос → "YYYY-MM"

  for (const deal of deals) {
    const inPlay =
      deal.stage === "active" ||
      (deal.stage === "closed" && (lastCollection.get(deal.id) ?? "") >= `${month}-01`);
    // Без кредита: план — полные суммы взносов, а не остаток к доплате
    const schedule = scheduleForDeal({ ...deal, credit: 0 }, 0);
    dueMonthOf.set(deal.id, new Map(schedule.map((p) => [p.n, p.iso.slice(0, 7)])));
    if (!inPlay) continue;

    const due = schedule.filter((p) => p.iso.startsWith(month));
    if (due.length === 0) continue;
    const sum = due.reduce((s, p) => s + p.amount, 0);
    for (const row of [total, managerRow(deal), branchRow(deal)]) {
      row.auto += sum;
      row.deals += 1;
    }
    for (const p of due) planByDay[Number(p.iso.slice(8, 10))] += p.amount;
  }

  for (const t of collections) {
    if (!t.date.startsWith(month)) continue;
    const deal = dealById.get(t.dealId!);
    if (!deal) continue;
    const dueMonth = t.installmentNumber ? dueMonthOf.get(deal.id)?.get(t.installmentNumber) : undefined;
    const bucket: "onPlan" | "arrears" | "ahead" =
      dueMonth === undefined ? "ahead" : dueMonth < month ? "arrears" : dueMonth > month ? "ahead" : "onPlan";
    for (const row of [total, managerRow(deal), branchRow(deal)]) {
      row.fact += t.amount;
      row[bucket] += t.amount;
    }
    factByDay[Number(t.date.slice(8, 10))] += t.amount;
  }

  // Цели менеджеров заменяют их автоматический план; у компании план —
  // сумма планов менеджеров
  for (const row of byManager.values()) {
    const target = row.key === "none" ? undefined : targets.get(Number(row.key));
    if (target !== undefined) row.target = target;
    row.plan = target ?? row.auto;
  }
  // Менеджер с целью, но без единого взноса в месяце — тоже в таблице
  for (const [id, target] of targets) {
    if (byManager.has(String(id))) continue;
    const name = managers.find((m) => m.id === id)?.name;
    if (!name) continue;
    byManager.set(String(id), { ...emptyRow(String(id), name), target, plan: target });
  }
  total.plan = [...byManager.values()].reduce((s, r) => s + r.plan, 0);
  for (const row of byBranch.values()) row.plan = row.auto;

  const daily: PlanFact["daily"] = [];
  let p = 0;
  let f = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    p += planByDay[day];
    f += factByDay[day];
    daily.push({ day, plan: p, fact: f });
  }

  const byPlan = (a: PlanFactRow, b: PlanFactRow) => b.plan - a.plan || a.label.localeCompare(b.label);
  return {
    month,
    total,
    byManager: [...byManager.values()].sort(byPlan),
    byBranch: [...byBranch.values()].sort(byPlan),
    daily,
  };
}

/** Выполнение плана в процентах; план 0 — null (делить не на что). */
export const completion = (row: Pick<PlanFactRow, "plan" | "fact">) =>
  row.plan > 0 ? Math.round((row.fact / row.plan) * 100) : null;
