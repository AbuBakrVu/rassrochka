// Импорт из Excel: колонки, разбор чисел и дат, проверка строк (lib/import.ts).
// Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRow, clientKey, detectColumns, parseDate, parseNumber } from "./import.ts";

const TODAY = "2026-10-05";

test("колонки находятся по заголовкам, «Дата рождения» не путается с «Дата»", () => {
  const cols = detectColumns(["ФИО", "Телефон", "Дата рождения", "Товар", "Цена", "Срок, мес", "Дата выдачи", "Оплачено", "Наценка %"]);
  assert.equal(cols.name, 0);
  assert.equal(cols.phone, 1);
  assert.equal(cols.birthDate, 2);
  assert.equal(cols.product, 3);
  assert.equal(cols.total, 4);
  assert.equal(cols.months, 5);
  assert.equal(cols.openedAt, 6);
  assert.equal(cols.paid, 7);
  assert.equal(cols.markupPct, 8);
});

test("числа в русском формате", () => {
  assert.equal(parseNumber("12 500,50 ₽"), 12500.5);
  assert.equal(parseNumber(" 15% "), 15);
  assert.equal(parseNumber("12500.50"), 12500.5);
  assert.equal(parseNumber("3 000 руб."), 3000);
  assert.equal(parseNumber(""), undefined);
  assert.ok(Number.isNaN(parseNumber("около тысячи")));
});

test("даты: серийник Excel, точки, ISO, мусор", () => {
  assert.equal(parseDate(46300), "2026-10-05");
  assert.equal(parseDate(45658), "2025-01-01");
  assert.equal(parseDate("05.10.2026"), "2026-10-05");
  assert.equal(parseDate("5.1.26"), "2026-01-05");
  assert.equal(parseDate("2026-10-05"), "2026-10-05");
  assert.equal(parseDate("31.02.2026"), "bad");
  assert.equal(parseDate(""), undefined);
});

test("строка сделки: сумма в рассрочку = цена − взнос, наценка из закупки", () => {
  const r = checkRow(
    { name: "Иванов Иван", phone: "+7 911 123-45-67", product: "iPhone", total: "120 000", down: "20000", purchase: "100000", months: 10, openedAt: "01.06.2026", paid: "30000" },
    2,
    TODAY
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.row?.deal?.amount, 100000);
  assert.equal(r.row?.deal?.markupPct, 20);
  assert.equal(r.row?.deal?.paid, 30000);
});

test("ошибки строки не дают сделку, клиент без товара — только клиент", () => {
  const bad = checkRow({ name: "Петров", product: "Диван", total: "50000", months: "0", openedAt: "2027-01-01" }, 3, TODAY);
  assert.ok(bad.errors.some((e) => e.startsWith("срок")));
  assert.ok(bad.errors.includes("дата выдачи в будущем"));
  assert.equal(bad.row, undefined);

  const onlyClient = checkRow({ name: "Сидорова Анна", phone: "89111234567" }, 4, TODAY);
  assert.deepEqual(onlyClient.errors, []);
  assert.equal(onlyClient.row?.deal, undefined);
});

test("оплачено больше долга — ошибка", () => {
  const r = checkRow({ name: "Иванов", phone: "9111234567", product: "ТВ", total: 30000, months: 3, openedAt: "2026-05-01", paid: 40000 }, 5, TODAY);
  assert.ok(r.errors.includes("оплачено больше суммы в рассрочку"));
});

test("дубль клиента по последним 10 цифрам телефона", () => {
  assert.equal(clientKey({ phone: "+7 (911) 123-45-67", name: "А" }), clientKey({ phone: "89111234567", name: "Б" }));
  assert.equal(clientKey({ phone: "—", name: "Иванов  Иван" }), "n:иванов иван");
});
