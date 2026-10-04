// Правила распределения платежей по графику (lib/payments.ts).
// Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { allocatePayment, nextDue, remainingDue, stateFromPayments } from "./payments.ts";

// График 6 × 21 908, последний взнос забирает остаток округления
const PLAN = [21908, 21908, 21908, 21908, 21908, 21910];

test("ровно один взнос закрывает его и ничего не оставляет", () => {
  const r = allocatePayment(PLAN, 0, 0, 21908);
  assert.ok(r.ok);
  assert.deepEqual(r.parts, [{ installment: 1, amount: 21908, completes: true }]);
  assert.equal(r.paid, 1);
  assert.equal(r.credit, 0);
});

test("переплата не теряется: остаток идёт в счёт следующего взноса", () => {
  const r = allocatePayment(PLAN, 0, 0, 25000);
  assert.ok(r.ok);
  assert.equal(r.paid, 1);
  assert.equal(r.credit, 3092);
  assert.deepEqual(r.parts.map((p) => p.amount), [21908, 3092]);
  assert.equal(r.parts[1].completes, false);
  // Долг уменьшился ровно на внесённую сумму
  assert.equal(remainingDue(PLAN, r.paid, r.credit), remainingDue(PLAN, 0, 0) - 25000);
});

test("частичная оплата копится и закрывает взнос, когда набралась сумма", () => {
  const first = allocatePayment(PLAN, 0, 0, 10000);
  assert.ok(first.ok);
  assert.equal(first.paid, 0);
  assert.equal(first.credit, 10000);
  assert.equal(nextDue(PLAN, first.paid, first.credit), 11908);

  const second = allocatePayment(PLAN, first.paid, first.credit, 11908);
  assert.ok(second.ok);
  assert.equal(second.paid, 1);
  assert.equal(second.credit, 0);
  assert.deepEqual(second.parts, [{ installment: 1, amount: 11908, completes: true }]);
});

test("крупная сумма закрывает несколько взносов подряд", () => {
  const r = allocatePayment(PLAN, 2, 5000, 50000);
  assert.ok(r.ok);
  assert.deepEqual(
    r.parts.map((p) => [p.installment, p.amount, p.completes]),
    [
      [3, 16908, true],
      [4, 21908, true],
      [5, 11184, false],
    ]
  );
  assert.equal(r.paid, 4);
  assert.equal(r.credit, 11184);
});

test("последний взнос закрывает сделку без остатка", () => {
  const r = allocatePayment(PLAN, 5, 1000, 20910);
  assert.ok(r.ok);
  assert.equal(r.paid, 6);
  assert.equal(r.credit, 0);
});

test("больше остатка долга принять нельзя", () => {
  const r = allocatePayment(PLAN, 5, 1000, 20911);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.error === "TOO_HIGH" && r.max === 20910);
});

test("ноль и отрицательная сумма отклоняются", () => {
  assert.equal(allocatePayment(PLAN, 0, 0, 0).ok, false);
  assert.equal(allocatePayment(PLAN, 0, 0, -5).ok, false);
});

test("копейки не ломают закрытие взноса", () => {
  const plan = [333.33, 333.33, 333.34];
  const r = allocatePayment(plan, 0, 0, 666.66);
  assert.ok(r.ok);
  assert.equal(r.paid, 2);
  assert.equal(r.credit, 0);
});

test("состояние после отмены пересчитывается по оставшимся платежам", () => {
  // Взнос 1 закрыт, по взносу 2 внесено 3 092 + 5 000
  const payments = [
    { installment: 1, amount: 21908 },
    { installment: 2, amount: 3092 },
    { installment: 2, amount: 5000 },
  ];
  assert.deepEqual(stateFromPayments(PLAN, payments), { paid: 1, credit: 8092 });
  // Отменили последнюю частичную запись
  assert.deepEqual(stateFromPayments(PLAN, payments.slice(0, 2)), { paid: 1, credit: 3092 });
  // Отменили всё, кроме первого платежа
  assert.deepEqual(stateFromPayments(PLAN, payments.slice(0, 1)), { paid: 1, credit: 0 });
  assert.deepEqual(stateFromPayments(PLAN, []), { paid: 0, credit: 0 });
});

test("старый формат: переплата, дописанная к взносу, просто закрывает его", () => {
  assert.deepEqual(stateFromPayments(PLAN, [{ installment: 1, amount: 25000 }]), { paid: 1, credit: 0 });
});

test("распределение и пересчёт сходятся", () => {
  let paid = 0;
  let credit = 0;
  const rows: { installment: number; amount: number }[] = [];
  for (const sum of [5000, 30000, 21908, 100, 40000]) {
    const r = allocatePayment(PLAN, paid, credit, sum);
    assert.ok(r.ok);
    rows.push(...r.parts.map((p) => ({ installment: p.installment, amount: p.amount })));
    paid = r.paid;
    credit = r.credit;
    assert.deepEqual(stateFromPayments(PLAN, rows), { paid, credit });
  }
});
