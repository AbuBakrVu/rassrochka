// План графика: реструктуризация и отсрочка (lib/schedule.ts). Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonthsIso, buildSchedule, planOf, splitPlan, type PlanItem } from "./schedule.ts";

const sum = (plan: PlanItem[]) => Math.round(plan.reduce((s, p) => s + p.amount, 0) * 100) / 100;

/** Так же, как restructureDeal на сервере: оплаченное остаётся, остаток делится заново. */
function restructure(amount: number, plan: PlanItem[], paid: number, months: number, from: string) {
  const kept = plan.slice(0, paid);
  return [...kept, ...splitPlan(amount - sum(kept), months, from)];
}

test("равный график из плана совпадает с вычисленным", () => {
  const plan = planOf({ amount: 120000, months: 6, openedAt: "2026-01-15" });
  assert.equal(plan.length, 6);
  assert.equal(sum(plan), 120000);
  assert.equal(plan[0].iso, "2026-02-15");
  const fromPlan = buildSchedule(120000, 6, 2, "2026-01-15", { plan });
  assert.deepEqual(
    fromPlan.map((p) => [p.iso, p.amount, p.status]),
    buildSchedule(120000, 6, 2, "2026-01-15").map((p) => [p.iso, p.amount, p.status])
  );
});

test("повторная реструктуризация не меняет суммы уже оплаченных взносов", () => {
  const amount = 120000;
  let plan = planOf({ amount, months: 6, openedAt: "2026-01-15" }); // 6 × 20 000
  // Оплачено 2 взноса, остаток 80 000 → 10 месяцев по 8 000
  plan = restructure(amount, plan, 2, 10, "2026-05-01");
  assert.equal(plan.length, 12);
  assert.deepEqual(plan.slice(0, 2).map((p) => p.amount), [20000, 20000]);
  assert.equal(plan[2].amount, 8000);
  // Оплачено ещё 3 по новому графику, остаток 56 000 → 4 месяца по 14 000
  plan = restructure(amount, plan, 5, 4, "2026-09-01");
  assert.equal(plan.length, 9);
  // Раньше здесь оплаченные взносы пересчитывались как amount / originalMonths
  assert.deepEqual(plan.slice(0, 5).map((p) => p.amount), [20000, 20000, 8000, 8000, 8000]);
  assert.deepEqual(plan.slice(5).map((p) => p.amount), [14000, 14000, 14000, 14000]);
  assert.equal(sum(plan), amount);
});

test("остаток округления уходит в последний взнос", () => {
  const plan = splitPlan(100000, 3, "2026-01-10");
  assert.deepEqual(plan.map((p) => p.amount), [33333, 33333, 33334]);
  assert.equal(sum(plan), 100000);
});

test("отсрочка сдвигает только неоплаченные взносы", () => {
  const plan = planOf({ amount: 60000, months: 3, openedAt: "2026-01-20" });
  const shifted = plan.map((p, i) => (i < 1 ? p : { ...p, iso: addMonthsIso(p.iso, 2) }));
  assert.deepEqual(shifted.map((p) => p.iso), ["2026-02-20", "2026-05-20", "2026-06-20"]);
  assert.equal(sum(shifted), 60000);
});
