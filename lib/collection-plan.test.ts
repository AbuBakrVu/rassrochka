// План/факт сборов за месяц (lib/collection-plan.ts).
// Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { completion, computePlanFact } from "./collection-plan.ts";
import type { Deal } from "./data.ts";
import type { CashTx } from "./store.tsx";

// Сделка на 3 × 10 000, открыта 15 августа: взносы 15 сентября, октября, ноября
const deal = (over: Partial<Deal> = {}): Deal => ({
  id: "R-1",
  clientId: "C-1",
  client: "Иванов",
  product: "Телефон",
  amount: 30000,
  months: 3,
  openedAt: "2026-08-15",
  stage: "active",
  status: "",
  statusTone: "blue",
  nextStep: "",
  manager: "АС",
  managerId: 1,
  branchId: 1,
  markupPct: 15,
  portalToken: "",
  guarantors: [],
  ...over,
});

const pay = (date: string, amount: number, installmentNumber?: number, title = "Платёж", dealId = "R-1"): CashTx => ({
  id: `${date}-${amount}-${installmentNumber}`,
  kind: "payment",
  amount,
  date,
  dealId,
  title,
  ...(installmentNumber !== undefined ? { installmentNumber } : {}),
});

const base = {
  managers: [{ id: 1, name: "Алексей" }, { id: 2, name: "Мария" }],
  branches: [{ id: 1, name: "Основной" }],
  targets: new Map<number, number>(),
};

test("план — взносы месяца, факт раскладывается по корзинам", () => {
  const r = computePlanFact({
    ...base,
    month: "2026-10",
    deals: [deal()],
    cash: [
      pay("2026-10-02", 10000, 1), // сентябрьский — просрочка
      pay("2026-10-15", 10000, 2), // октябрьский — план
      pay("2026-10-20", 4000, 3), // часть ноябрьского — вперёд
      pay("2026-09-30", 10000, 1, "Платёж", "R-1"), // другой месяц — не считается
    ],
  });
  assert.equal(r.total.auto, 10000);
  assert.equal(r.total.plan, 10000);
  assert.equal(r.total.fact, 24000);
  assert.equal(r.total.onPlan, 10000);
  assert.equal(r.total.arrears, 10000);
  assert.equal(r.total.ahead, 4000);
  assert.equal(completion(r.total), 240);
  assert.equal(r.daily.length, 31);
  assert.equal(r.daily[14].plan, 10000); // 15 октября
  assert.equal(r.daily[30].fact, 24000);
});

test("первый взнос не сбор, отмена уменьшает факт", () => {
  const r = computePlanFact({
    ...base,
    month: "2026-10",
    deals: [deal()],
    cash: [
      pay("2026-10-01", 5000, undefined, "Первоначальный взнос · Телефон"),
      pay("2026-10-15", 10000, 2),
      pay("2026-10-16", -10000, 2, "Отмена платежа"),
    ],
  });
  assert.equal(r.total.fact, 0);
});

test("цель менеджера заменяет его план, компания — сумма планов", () => {
  const r = computePlanFact({
    ...base,
    month: "2026-10",
    deals: [deal(), deal({ id: "R-2", managerId: 2 })],
    cash: [],
    targets: new Map([[1, 15000], [2, 8000]]),
  });
  const alexey = r.byManager.find((m) => m.label === "Алексей")!;
  assert.equal(alexey.auto, 10000);
  assert.equal(alexey.target, 15000);
  assert.equal(alexey.plan, 15000);
  assert.equal(r.total.plan, 23000);
});

test("заявки и давно закрытые сделки в план не входят", () => {
  const r = computePlanFact({
    ...base,
    month: "2026-10",
    deals: [deal({ stage: "new" }), deal({ id: "R-2", stage: "closed" })],
    cash: [pay("2026-09-10", 30000, undefined, "Досрочное погашение остатка", "R-2")],
  });
  assert.equal(r.total.plan, 0);
  assert.equal(completion(r.total), null);
});

test("закрытая в этом месяце досрочно — план остаётся, погашение — «вперёд»", () => {
  const r = computePlanFact({
    ...base,
    month: "2026-10",
    deals: [deal({ stage: "closed" })],
    cash: [pay("2026-10-05", 20000, undefined, "Досрочное погашение остатка")],
  });
  assert.equal(r.total.plan, 10000);
  assert.equal(r.total.ahead, 20000);
});
