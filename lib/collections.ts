// Работа с просрочкой: очередь звонков на сегодня и обещания оплатить.
// Чистые функции — данные приходят из стора (контакты — таблица
// contact_log, миграция 022), проверяются тестом lib/collections.test.ts.

export type ContactOutcome = "promise" | "callback" | "no_answer" | "refused" | "paid" | "other";

export const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  promise: "Обещал оплатить",
  callback: "Просил перезвонить",
  no_answer: "Не дозвонились",
  refused: "Отказывается платить",
  paid: "Говорит, что оплатил",
  other: "Другое",
};

export interface ContactLog {
  id: string;
  dealId: string;
  userId?: number;
  outcome: ContactOutcome;
  /** Дата обещанной оплаты или когда перезвонить, ГГГГ-ММ-ДД. */
  dueDate?: string;
  amount?: number;
  note?: string;
  /** Когда записан контакт, ISO. */
  at: string;
}

/**
 * Состояние сделки в очереди:
 *   broken    — обещал оплатить, срок прошёл, денег с тех пор не было;
 *   callback  — просил перезвонить, и этот день настал;
 *   new       — давно не связывались (или никогда);
 *   done      — сегодня уже звонили, до завтра не трогаем;
 *   waiting   — ждём оплату по обещанию или звонок в будущий день.
 * В очередь «на сегодня» попадают broken, callback и new.
 */
export type QueueState = "broken" | "callback" | "new" | "done" | "waiting";

export interface QueueInput {
  dealId: string;
  daysLate: number;
  overdueSum: number;
}

export interface QueueItem extends QueueInput {
  state: QueueState;
  last?: ContactLog;
  /** Действующее обещание — для подписи «обещал 25 000 ₽ к 12 октября». */
  promise?: ContactLog;
  priority: number;
}

export function queueState(
  contacts: ContactLog[],
  payments: { date: string }[],
  today: string
): { state: QueueState; last?: ContactLog; promise?: ContactLog } {
  const sorted = [...contacts].sort((a, b) => b.at.localeCompare(a.at));
  const last = sorted[0];
  if (!last) return { state: "new" };

  const lastDay = last.at.slice(0, 10);
  const promise = sorted.find((c) => c.outcome === "promise");
  if (promise && promise.dueDate && promise === last) {
    if (promise.dueDate >= today) return { state: "waiting", last, promise };
    // Срок обещания прошёл: платил ли клиент после того, как обещал
    const paidSince = payments.some((p) => p.date >= promise.at.slice(0, 10));
    return { state: paidSince ? "new" : "broken", last, promise };
  }
  if (last.outcome === "callback" && last.dueDate) {
    return { state: last.dueDate <= today ? "callback" : "waiting", last };
  }
  return { state: lastDay === today ? "done" : "new", last };
}

const STATE_WEIGHT: Record<QueueState, number> = {
  broken: 3000,
  callback: 2000,
  new: 1000,
  done: 0,
  waiting: 0,
};

/** Очередь по всем просроченным сделкам: нарушенные обещания, затем перезвоны, затем остальные по сроку и сумме. */
export function buildQueue(
  overdue: QueueInput[],
  contacts: ContactLog[],
  payments: { dealId?: string; date: string }[],
  today: string
): QueueItem[] {
  return overdue
    .map((o) => {
      const s = queueState(
        contacts.filter((c) => c.dealId === o.dealId),
        payments.filter((p) => p.dealId === o.dealId),
        today
      );
      return {
        ...o,
        ...s,
        priority: STATE_WEIGHT[s.state] + Math.min(o.daysLate, 365) + Math.min(o.overdueSum / 10000, 100),
      };
    })
    .sort((a, b) => b.priority - a.priority);
}
