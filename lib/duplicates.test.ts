// Поиск дублей клиента (lib/duplicates.ts). Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicates, phoneKey } from "./duplicates.ts";

const clients = [
  { id: "C-1", name: "Иванов Иван", phone: "+7 (999) 123-45-67", passportSeries: "4510", passportNumber: "123456" },
  { id: "C-2", name: "Петров Пётр", phone: "—" },
];

test("телефон: 8 и +7 — один номер", () => {
  assert.equal(phoneKey("8 999 123 45 67"), phoneKey("+7 (999) 123-45-67"));
  assert.equal(phoneKey("—"), null);
  assert.equal(phoneKey("+7 (999"), null);
});

test("находит по телефону", () => {
  const d = findDuplicates(clients, { phone: "89991234567" });
  assert.deepEqual(d.map((x) => [x.client.id, x.reasons]), [["C-1", ["phone"]]]);
});

test("находит по паспорту, только полному", () => {
  assert.deepEqual(
    findDuplicates(clients, { passportSeries: "4510", passportNumber: "123456" }).map((x) => x.reasons),
    [["passport"]]
  );
  assert.equal(findDuplicates(clients, { passportSeries: "4510", passportNumber: "12" }).length, 0);
});

test("пустой ввод и прочерк в телефоне не дают ложных совпадений", () => {
  assert.equal(findDuplicates(clients, { phone: "+7" }).length, 0);
  assert.equal(findDuplicates(clients, { phone: "—" }).length, 0);
});
