import "server-only";

// Запросы к базе компании и превращение строк БД в типы приложения.
//
// Сериализация специально возвращает ровно те формы, которые сегодня лежат
// в сторе (Deal, Client, paidPayments, CashTx, DealEvent). Благодаря этому
// на этапе 3 меняются только внутренности lib/store.tsx, а страницы,
// lib/derive.ts и buildRoute продолжают работать без единой правки.

import { query, queryOne, transaction } from "./db";
import { buildRoute, type Client, type Deal, type DealStage } from "./data";
import { buildSchedule, monthNames } from "./schedule";
import { computeClientStatus, computeDealStatus, todayIso } from "./status";
import type { CashTx } from "./store";
import type { DealEvent } from "./events";

// ── Формы строк БД ─────────────────────────────────────────────────────

interface DealRow extends Record<string, unknown> {
  id: string;
  client_id: string;
  client_name: string;
  product: string;
  amount: number;
  months: number;
  markup_pct: number;
  opened_at: string;
  stage: DealStage;
  manager_initials: string | null;
  paid_count: number;
  next_step: string | null;
  deadline: string | null;
  reject_reason: string | null;
}

interface ClientRow extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  since: string;
}

interface CashRow extends Record<string, unknown> {
  id: string;
  kind: CashTx["kind"];
  amount: number;
  occurred_at: string;
  deal_id: string | null;
  title: string;
  note: string | null;
}

interface EventRow extends Record<string, unknown> {
  id: string;
  deal_id: string;
  occurred_at: Date;
  text: string;
}

// ── Форматирование дат ─────────────────────────────────────────────────

/** "2026-08-06" → "6 августа". Формат важен: computeCalendar разбирает день через parseInt. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${monthNames[Number(m) - 1]}`;
}

/** "2025-09-01" → "сентября 2025" — так выглядит Client.since в интерфейсе. */
function sinceLabel(iso: string): string {
  const [y, m] = iso.split("-");
  return `${monthNames[Number(m) - 1]} ${y}`;
}

// Подсказка менеджеру, если он ничего не написал руками
const DEFAULT_NEXT_STEP: Record<DealStage, string> = {
  new: "Связаться с клиентом",
  check: "Проверить документы",
  signing: "Подписать договор",
  active: "Ждём платёж",
  closed: "Выплачена полностью",
  rejected: "Отказ",
};

// ── Сериализация ───────────────────────────────────────────────────────

function toDeal(row: DealRow, today: string): Deal {
  const { status, statusTone, urgent } = computeDealStatus(
    {
      stage: row.stage,
      amount: row.amount,
      months: row.months,
      paid: row.paid_count,
      openedAt: row.opened_at,
      deadline: row.deadline,
    },
    today
  );

  const nextStep =
    row.stage === "rejected"
      ? `Отказ: ${row.reject_reason ?? "причина не указана"}`
      : (row.next_step ?? DEFAULT_NEXT_STEP[row.stage]);

  return {
    id: row.id,
    clientId: row.client_id,
    client: row.client_name,
    product: row.product,
    amount: row.amount,
    months: row.months,
    openedAt: row.opened_at,
    stage: row.stage,
    status,
    statusTone,
    nextStep,
    markupPct: row.markup_pct,
    manager: row.manager_initials ?? "—",
    ...(row.deadline ? { deadline: shortDate(row.deadline) } : {}),
    ...(urgent ? { urgent: true } : {}),
  };
}

function toClient(row: ClientRow, deals: Deal[], today: string): Client {
  const own = deals.filter((d) => d.clientId === row.id);
  const { status, statusLabel } = computeClientStatus(own);

  // Ближайшее действие берём из общей приоритизации маршрута — той же,
  // что питает /route и панель уведомлений
  const top = buildRoute(own)[0];

  // Дедлайн у сделки уже отформатирован в toDeal («6 августа»), поэтому
  // сравниваем с сегодняшним днём в том же виде
  const deadline = own.find((d) => d.id === top?.dealId)?.deadline;
  const nextDate = !top
    ? "—"
    : deadline && deadline !== shortDate(today)
      ? deadline
      : "Сегодня";

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    since: sinceLabel(row.since),
    status,
    statusLabel,
    nextAction: top?.text ?? "—",
    nextDate,
  };
}

// ── Чтение ─────────────────────────────────────────────────────────────

const DEALS_SELECT = `
  select d.id, d.client_id, c.name as client_name, d.product, d.amount,
         d.months, d.markup_pct, d.opened_at, d.stage, d.paid_count,
         d.next_step, d.deadline, d.reject_reason,
         u.initials as manager_initials
  from deals d
  join clients c on c.id = d.client_id
  left join users u on u.id = d.manager_id
`;

const DEALS_SQL = `${DEALS_SELECT} order by d.created_at desc`;
const DEAL_BY_ID_SQL = `${DEALS_SELECT} where d.id = $1`;

export interface Bootstrap {
  deals: Deal[];
  clients: Client[];
  paidPayments: Record<string, number>;
  cash: CashTx[];
  events: DealEvent[];
  settings: { cashOpeningBalance: number };
}

/**
 * Всё состояние компании одним запросом — прямая замена чтения localStorage.
 * При сотнях сделок это дешевле, чем множить запросы по страницам; когда
 * данных станет много, разделим по разделам.
 */
export async function loadBootstrap(dbName: string): Promise<Bootstrap> {
  const today = todayIso();

  const [dealRows, clientRows, cashRows, eventRows, settingRows] =
    await Promise.all([
      query<DealRow>(dbName, DEALS_SQL),
      query<ClientRow>(dbName, "select * from clients order by created_at desc"),
      query<CashRow>(dbName, "select * from cash_tx order by occurred_at, id"),
      query<EventRow>(dbName, "select * from deal_events order by occurred_at desc"),
      query<{ key: string; value: unknown }>(dbName, "select key, value from settings"),
    ]);

  const deals = dealRows.map((r) => toDeal(r, today));

  const paidPayments: Record<string, number> = {};
  for (const row of dealRows) paidPayments[row.id] = row.paid_count;

  const opening = settingRows.find((s) => s.key === "cash_opening_balance");

  return {
    deals,
    clients: clientRows.map((r) => toClient(r, deals, today)),
    paidPayments,
    cash: cashRows.map((r) => ({
      id: String(r.id),
      kind: r.kind,
      amount: r.amount,
      date: r.occurred_at,
      title: r.title,
      ...(r.deal_id ? { dealId: r.deal_id } : {}),
      ...(r.note ? { note: r.note } : {}),
    })),
    events: eventRows.map((r) => ({
      id: String(r.id),
      dealId: r.deal_id,
      date: r.occurred_at.toISOString().slice(0, 10),
      text: r.text,
    })),
    settings: { cashOpeningBalance: Number(opening?.value ?? 0) },
  };
}

async function loadDeal(dbName: string, id: string): Promise<Deal | undefined> {
  const row = await queryOne<DealRow>(dbName, DEAL_BY_ID_SQL, [id]);
  return row ? toDeal(row, todayIso()) : undefined;
}

// ── Запись ─────────────────────────────────────────────────────────────

export interface NewClientInput {
  lastName: string;
  firstName: string;
  phone: string;
}

export async function createClient(
  dbName: string,
  input: NewClientInput
): Promise<Client> {
  const name = `${input.lastName} ${input.firstName}`.trim();
  const row = await queryOne<ClientRow>(
    dbName,
    `insert into clients (name, phone) values ($1, $2)
     returning id, name, phone, email, city, since`,
    [name, input.phone || "—"]
  );
  if (!row) throw new Error("Клиент не создан");
  return toClient(row, [], todayIso());
}

export interface NewDealInput {
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  clientId: string;
  managerInitials: string;
  markupPct: number;
}

export async function createDeal(
  dbName: string,
  input: NewDealInput
): Promise<Deal> {
  const purchase = input.amount - Math.round((input.amount * input.markupPct) / 100);

  const id = await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ id: string; product: string }>(
      `insert into deals (client_id, product, amount, months, markup_pct, opened_at,
                          manager_id, stage)
       values ($1, $2, $3, $4, $5, $6,
               (select id from users where initials = $7 and active limit 1), 'new')
       returning id, product`,
      [
        input.clientId,
        input.product,
        input.amount,
        input.months,
        input.markupPct,
        input.openedAt,
        input.managerInitials,
      ]
    );
    const deal = rows[0];

    const { rows: clientRows } = await client.query<{ name: string }>(
      "select name from clients where id = $1",
      [input.clientId]
    );
    const clientName = clientRows[0]?.name ?? "";

    // Закупка товара сразу уменьшает остаток кассы
    await client.query(
      `insert into cash_tx (kind, amount, occurred_at, deal_id, title, note)
       values ('purchase', $1, $2, $3, $4, $5)`,
      [-purchase, input.openedAt, deal.id, `Закупка товара · ${deal.product}`, clientName]
    );

    await client.query(
      `insert into deal_events (deal_id, text, user_id)
       values ($1, $2, (select id from users where initials = $3 and active limit 1))`,
      [deal.id, `Сделка создана · ответственный ${input.managerInitials}`, input.managerInitials]
    );

    return deal.id;
  });

  const created = await loadDeal(dbName, id);
  if (!created) throw new Error("Сделка создана, но не читается");
  return created;
}

/**
 * Принимает один ближайший взнос: увеличивает счётчик, приходует деньги в
 * кассу и пишет событие в историю — одной транзакцией.
 *
 * `for update` держит строку до конца транзакции: без него два менеджера,
 * нажавшие «Принять платёж» одновременно, засчитали бы два взноса вместо
 * одного. В версии на localStorage такой защиты не было в принципе.
 */
export async function acceptPayment(
  dbName: string,
  dealId: string
): Promise<{ deal: Deal; alreadyPaid: boolean }> {
  const alreadyPaid = await transaction(dbName, async (client) => {
    const { rows } = await client.query<{
      id: string;
      amount: number;
      months: number;
      paid_count: number;
      opened_at: string;
      product: string;
      client_name: string;
    }>(
      `select d.id, d.amount, d.months, d.paid_count, d.opened_at, d.product,
              c.name as client_name
       from deals d join clients c on c.id = d.client_id
       where d.id = $1
       for update of d`,
      [dealId]
    );

    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    if (deal.paid_count >= deal.months) return true;

    const next = deal.paid_count + 1;
    const installment = buildSchedule(
      deal.amount,
      deal.months,
      next,
      deal.opened_at
    )[next - 1];

    await client.query(
      "update deals set paid_count = $2 where id = $1",
      [dealId, next]
    );

    // Последняя оплата закрывает сделку
    if (next === deal.months) {
      await client.query(
        "update deals set stage = 'closed' where id = $1 and stage = 'active'",
        [dealId]
      );
    }

    // Дата операции — сегодняшняя, а НЕ плановая дата взноса из графика.
    // Клиент может гасить июльский платёж в августе: деньги пришли в
    // августе, иначе «Приход за месяц» в кассе считался бы неверно.
    await client.query(
      `insert into cash_tx (kind, amount, occurred_at, deal_id, title, note)
       values ('payment', $1, $2, $3, $4, $5)`,
      [
        installment.amount,
        todayIso(),
        dealId,
        `Платёж ${next} из ${deal.months} · ${deal.client_name}`,
        deal.product,
      ]
    );

    await client.query(
      "insert into deal_events (deal_id, text) values ($1, $2)",
      [
        dealId,
        `Платёж ${next} из ${deal.months} принят — ${installment.amount.toLocaleString("ru-RU")} ₽`,
      ]
    );

    return false;
  });

  const deal = await loadDeal(dbName, dealId);
  if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
  return { deal, alreadyPaid };
}

export interface CashAdjustmentInput {
  amount: number;
  title: string;
  date: string;
}

export async function addCashAdjustment(
  dbName: string,
  input: CashAdjustmentInput
): Promise<CashTx> {
  const row = await queryOne<CashRow>(
    dbName,
    `insert into cash_tx (kind, amount, occurred_at, title)
     values ('adjustment', $1, $2, $3)
     returning id, kind, amount, occurred_at, deal_id, title, note`,
    [input.amount, input.date, input.title]
  );
  if (!row) throw new Error("Операция не создана");

  return {
    id: String(row.id),
    kind: row.kind,
    amount: row.amount,
    date: row.occurred_at,
    title: row.title,
  };
}
