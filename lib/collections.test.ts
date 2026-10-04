// Очередь звонков по просрочкам (lib/collections.ts). Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueue, queueState, type ContactLog } from "./collections.ts";

const TODAY = "2026-10-10";
const c = (over: Partial<ContactLog>): ContactLog => ({
  id: "1",
  dealId: "R-1",
  outcome: "no_answer",
  at: "2026-10-01T10:00:00Z",
  ...over,
});

test("без контактов — новая в очереди", () => {
  assert.equal(queueState([], [], TODAY).state, "new");
});

test("обещание в будущем — ждём, не звоним", () => {
  const s = queueState([c({ outcome: "promise", dueDate: "2026-10-12" })], [], TODAY);
  assert.equal(s.state, "waiting");
});

test("обещание просрочено и платежа не было — нарушено", () => {
  const s = queueState([c({ outcome: "promise", dueDate: "2026-10-05" })], [], TODAY);
  assert.equal(s.state, "broken");
});

test("обещание просрочено, но клиент платил после обещания — снова в общей очереди", () => {
  const s = queueState(
    [c({ outcome: "promise", dueDate: "2026-10-05" })],
    [{ date: "2026-10-06" }],
    TODAY
  );
  assert.equal(s.state, "new");
});

test("платёж до обещания не считается исполнением", () => {
  const s = queueState(
    [c({ outcome: "promise", dueDate: "2026-10-05", at: "2026-10-03T09:00:00Z" })],
    [{ date: "2026-10-01" }],
    TODAY
  );
  assert.equal(s.state, "broken");
});

test("перезвон сегодня и в будущем", () => {
  assert.equal(queueState([c({ outcome: "callback", dueDate: TODAY })], [], TODAY).state, "callback");
  assert.equal(queueState([c({ outcome: "callback", dueDate: "2026-10-20" })], [], TODAY).state, "waiting");
});

test("сегодня уже звонили — до завтра не трогаем", () => {
  assert.equal(queueState([c({ at: `${TODAY}T08:00:00Z` })], [], TODAY).state, "done");
});

test("порядок: нарушенные обещания, перезвоны, остальные по сроку", () => {
  const q = buildQueue(
    [
      { dealId: "A", daysLate: 40, overdueSum: 50000 },
      { dealId: "B", daysLate: 3, overdueSum: 5000 },
      { dealId: "C", daysLate: 10, overdueSum: 8000 },
    ],
    [
      c({ dealId: "B", outcome: "promise", dueDate: "2026-10-05" }),
      c({ dealId: "C", outcome: "callback", dueDate: TODAY }),
    ],
    [],
    TODAY
  );
  assert.deepEqual(q.map((i) => [i.dealId, i.state]), [
    ["B", "broken"],
    ["C", "callback"],
    ["A", "new"],
  ]);
});
