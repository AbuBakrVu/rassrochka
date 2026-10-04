// Калькулятор и проверка онлайн-заявки (lib/apply.ts). Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyQuote, normalizeApplySettings, validateApplication } from "./apply.ts";

const s = normalizeApplySettings({ enabled: true, markupPct: 20, terms: [6, 3, 3, 99], minDownPct: 10 });

test("настройки: сроки без дублей и мусора, по порядку", () => {
  assert.deepEqual(s.terms, [3, 6]);
  assert.equal(normalizeApplySettings(null).enabled, false);
  assert.deepEqual(normalizeApplySettings({ terms: [] }).terms, [3, 6, 9, 12]);
});

test("расчёт: наценка, минимальный взнос, платёж округлён вверх", () => {
  const q = applyQuote(s, 50_000, 6, 0);
  assert.equal(q.total, 60_000);
  assert.equal(q.minDown, 6_000);
  assert.equal(q.down, 6_000); // меньше минимума — поднимается до него
  assert.equal(q.financed, 54_000);
  assert.equal(q.monthly, 9_000);
  assert.equal(applyQuote(s, 10_001, 3, 0).monthly * 3 >= applyQuote(s, 10_001, 3, 0).financed, true);
});

test("проверка заявки", () => {
  assert.equal(validateApplication(s, { price: 50_000, months: 6, down: 6_000 }), null);
  assert.match(validateApplication(s, { price: 500, months: 6, down: 0 })!, /Цена/);
  assert.match(validateApplication(s, { price: 50_000, months: 12, down: 6_000 })!, /срок/);
  assert.match(validateApplication(s, { price: 50_000, months: 6, down: 100 })!, /не меньше/);
  assert.match(validateApplication(s, { price: 50_000, months: 6, down: 60_000 })!, /больше цены/);
});
