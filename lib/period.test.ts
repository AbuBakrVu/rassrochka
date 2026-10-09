// Периоды Аналитики (lib/period.ts). Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { changePct, inRange, periodRanges } from "./period.ts";

test("месяц — с 1-го по сегодня против тех же дней прошлого месяца", () => {
  assert.deepEqual(periodRanges("month", "2026-10-09"), {
    current: { from: "2026-10-01", to: "2026-10-09" },
    previous: { from: "2026-09-01", to: "2026-09-09" },
  });
});

test("31-е число сравнивается с последним днём короткого месяца", () => {
  assert.deepEqual(periodRanges("month", "2026-03-31").previous, { from: "2026-02-01", to: "2026-02-28" });
});

test("январь сравнивается с декабрём прошлого года", () => {
  assert.deepEqual(periodRanges("month", "2026-01-15").previous, { from: "2025-12-01", to: "2025-12-15" });
});

test("квартал — с начала квартала против того же отрезка прошлого квартала", () => {
  assert.deepEqual(periodRanges("quarter", "2026-11-20"), {
    current: { from: "2026-10-01", to: "2026-11-20" },
    previous: { from: "2026-07-01", to: "2026-08-20" },
  });
});

test("год — с 1 января против того же отрезка прошлого года", () => {
  assert.deepEqual(periodRanges("year", "2026-10-09"), {
    current: { from: "2026-01-01", to: "2026-10-09" },
    previous: { from: "2025-01-01", to: "2025-10-09" },
  });
});

test("всё время — без границ и без сравнения", () => {
  const r = periodRanges("all", "2026-10-09");
  assert.equal(r.previous, null);
  assert.equal(inRange("2019-01-01", r.current), true);
});

test("границы периода включаются, время в дате не мешает", () => {
  const r = { from: "2026-10-01", to: "2026-10-09" };
  assert.equal(inRange("2026-10-01", r), true);
  assert.equal(inRange("2026-10-09T23:00:00Z", r), true);
  assert.equal(inRange("2026-10-10", r), false);
});

test("изменение в процентах; с нуля сравнивать не с чем", () => {
  assert.equal(changePct(150, 100), 50);
  assert.equal(changePct(50, 100), -50);
  assert.equal(changePct(10, 0), null);
});
