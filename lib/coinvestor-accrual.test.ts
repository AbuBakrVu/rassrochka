// Автоначисление фиксированного процента соинвестору (lib/coinvestor-accrual.ts).
// Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { averageCapital, fixedAccrual, periodLabel, periodsToAccrue } from "./coinvestor-accrual.ts";

test("капитал весь месяц — полная ставка", () => {
  const moves = [{ date: "2026-01-20", delta: 100_000 }];
  assert.equal(averageCapital(moves, "2026-02-01"), 100_000);
  assert.equal(fixedAccrual(moves, "2026-02-01", 3), 3000);
});

test("внёс в середине месяца — ставка по дням", () => {
  // Апрель — 30 дней, деньги с 16-го: 15 дней из 30
  const moves = [{ date: "2026-04-16", delta: 100_000 }];
  assert.equal(averageCapital(moves, "2026-04-01"), 50_000);
  assert.equal(fixedAccrual(moves, "2026-04-01", 2), 1000);
});

test("снятие уменьшает базу со дня снятия", () => {
  const moves = [
    { date: "2026-01-01", delta: 200_000 },
    { date: "2026-06-11", delta: -100_000 }, // июнь: 10 дней по 200к, 20 дней по 100к
  ];
  assert.equal(Math.round(averageCapital(moves, "2026-06-01")), Math.round((10 * 200_000 + 20 * 100_000) / 30));
});

test("нулевая ставка и пустой капитал — ничего не начисляем", () => {
  assert.equal(fixedAccrual([{ date: "2026-01-01", delta: 50_000 }], "2026-02-01", 0), 0);
  assert.equal(fixedAccrual([], "2026-02-01", 5), 0);
});

test("начисляются только закончившиеся месяцы и только недостающие", () => {
  assert.deepEqual(periodsToAccrue("2026-10-15", "2026-12-03", new Set()), ["2026-10-01", "2026-11-01"]);
  assert.deepEqual(periodsToAccrue("2026-10-15", "2026-12-03", new Set(["2026-10-01"])), ["2026-11-01"]);
  // Текущий месяц не начисляем
  assert.deepEqual(periodsToAccrue("2026-12-01", "2026-12-31", new Set()), []);
  // Через Новый год
  assert.deepEqual(periodsToAccrue("2026-12-05", "2027-02-01", new Set()), ["2026-12-01", "2027-01-01"]);
});

test("подпись месяца", () => {
  assert.equal(periodLabel("2026-03-01"), "март 2026");
});
