import "server-only";

// Запросы к базе компании и превращение строк БД в типы приложения.
//
// Сериализация специально возвращает ровно те формы, которые сегодня лежат
// в сторе (Deal, Client, paidPayments, CashTx, DealEvent). Благодаря этому
// на этапе 3 меняются только внутренности lib/store.tsx, а страницы,
// lib/derive.ts и buildRoute продолжают работать без единой правки.

import type { PoolClient } from "pg";
import { query, queryOne, transaction } from "./db";
import { buildRoute, purchasePrice, stages, type Client, type Deal, type DealStage } from "./data";
import { buildSchedule, monthNames, restructureOf } from "./schedule";
import { allocatePayment, nextDue, stateFromPayments } from "./payments";
import { computeClientStatus, computeDealStatus, isoDate, todayIso } from "./status";
import type {
  CashTx,
  Coinvestor,
  CoinvestorCapitalTx,
  CoinvestorProfitTx,
  MessageTemplate,
} from "./store";
import type { DealEvent } from "./events";
import { listSavedFilters, type SavedFilter } from "./saved-filters";

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
  manager_id: number | null;
  paid_count: number;
  credit: number;
  next_step: string | null;
  deadline: string | null;
  reject_reason: string | null;
  portal_token: string;
  description: string | null;
  category: string | null;
  city: string | null;
  guarantors: { id: string; name: string }[] | null;
  original_months: number | null;
  restructured_months: number | null;
  restructured_from: string | null;
  down_payment: number | null;
  reminder_template_id: number | null;
  last_reminder_stage: string | null;
  last_reminder_due_date: string | null;
}

interface ClientRow extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  since: string;
  middle_name: string | null;
  birth_date: string | null;
  passport_series: string | null;
  passport_number: string | null;
  passport_issued_by: string | null;
  passport_issued_at: string | null;
  registration_address: string | null;
  living_address: string | null;
  inn: string | null;
  blacklisted_at: Date | null;
  blacklist_reason: string | null;
  portal_token: string;
  credit_limit: number | null;
}

interface CashRow extends Record<string, unknown> {
  id: string;
  kind: CashTx["kind"];
  amount: number;
  occurred_at: string;
  deal_id: string | null;
  coinvestor_id: string | null;
  title: string;
  note: string | null;
  installment_number: number | null;
  method: "cash" | "card" | "transfer" | null;
  reverses_id: number | null;
}

interface CoinvestorRow extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string;
  profit_share_pct: number;
  started_at: string;
  active: boolean;
}

interface CoinvestorCapitalRow extends Record<string, unknown> {
  id: string;
  coinvestor_id: string;
  kind: CoinvestorCapitalTx["kind"];
  amount: number;
  occurred_at: string;
  note: string | null;
}

interface CoinvestorProfitRow extends Record<string, unknown> {
  id: string;
  coinvestor_id: string;
  deal_id: string | null;
  kind: CoinvestorProfitTx["kind"];
  amount: number;
  occurred_at: Date;
  note: string | null;
}

interface TemplateRow extends Record<string, unknown> {
  id: number;
  name: string;
  body: string;
  is_default: boolean;
  stage: string | null;
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
  const restructure = restructureOf({
    originalMonths: row.original_months,
    restructuredMonths: row.restructured_months,
    restructuredFrom: row.restructured_from,
  });

  const { status, statusTone, urgent } = computeDealStatus(
    {
      stage: row.stage,
      amount: row.amount,
      months: row.months,
      paid: row.paid_count,
      openedAt: row.opened_at,
      deadline: row.deadline,
      restructure,
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
    managerId: row.manager_id,
    portalToken: row.portal_token,
    guarantors: row.guarantors ?? [],
    ...(restructure
      ? {
          originalMonths: restructure.originalMonths,
          restructuredMonths: restructure.restructuredMonths,
          restructuredFrom: restructure.from,
        }
      : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.category ? { category: row.category } : {}),
    ...(row.city ? { city: row.city } : {}),
    ...(row.down_payment ? { downPayment: row.down_payment } : {}),
    ...(Number(row.credit) > 0 ? { credit: Number(row.credit) } : {}),
    ...(row.reminder_template_id ? { reminderTemplateId: String(row.reminder_template_id) } : {}),
    ...(row.last_reminder_stage
      ? { lastReminderStage: row.last_reminder_stage as Deal["lastReminderStage"] }
      : {}),
    ...(row.last_reminder_due_date ? { lastReminderDueDate: row.last_reminder_due_date } : {}),
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
    ...(top?.dealId ? { nextDealId: top.dealId } : {}),
    ...(row.middle_name ? { middleName: row.middle_name } : {}),
    ...(row.birth_date ? { birthDate: row.birth_date } : {}),
    ...(row.passport_series ? { passportSeries: row.passport_series } : {}),
    ...(row.passport_number ? { passportNumber: row.passport_number } : {}),
    ...(row.passport_issued_by ? { passportIssuedBy: row.passport_issued_by } : {}),
    ...(row.passport_issued_at ? { passportIssuedAt: row.passport_issued_at } : {}),
    ...(row.registration_address ? { registrationAddress: row.registration_address } : {}),
    ...(row.living_address ? { livingAddress: row.living_address } : {}),
    ...(row.inn ? { inn: row.inn } : {}),
    ...(row.blacklisted_at
      ? { blacklistedAt: row.blacklisted_at.toISOString() }
      : {}),
    ...(row.blacklist_reason ? { blacklistReason: row.blacklist_reason } : {}),
    portalToken: row.portal_token,
    ...(row.credit_limit !== null && row.credit_limit !== undefined
      ? { creditLimit: Number(row.credit_limit) }
      : {}),
  };
}

// ── Чтение ─────────────────────────────────────────────────────────────

const DEALS_SELECT = `
  select d.id, d.client_id, c.name as client_name, d.product, d.amount,
         d.months, d.markup_pct, d.opened_at, d.stage, d.paid_count, d.credit,
         d.next_step, d.deadline, d.reject_reason, d.portal_token,
         d.description, d.category, d.city,
         d.original_months, d.restructured_months, d.restructured_from,
         d.down_payment, d.reminder_template_id,
         d.last_reminder_stage, d.last_reminder_due_date,
         d.manager_id, u.initials as manager_initials,
         (
           select coalesce(json_agg(json_build_object('id', g.id, 'name', g.name)), '[]')
           from deal_guarantors dg
           join clients g on g.id = dg.client_id
           where dg.deal_id = d.id
         ) as guarantors
  from deals d
  join clients c on c.id = d.client_id
  left join users u on u.id = d.manager_id
  where d.deleted_at is null
`;

const DEALS_SQL = `${DEALS_SELECT} order by d.created_at desc`;
const DEAL_BY_ID_SQL = `${DEALS_SELECT} and d.id = $1`;

export interface Employee {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: "admin" | "manager" | "accountant";
  since: string;
  active: boolean;
}

export interface Bootstrap {
  user: { id: number; name: string; initials: string; email: string; role: string };
  employees: Employee[];
  deals: Deal[];
  clients: Client[];
  paidPayments: Record<string, number>;
  cash: CashTx[];
  events: DealEvent[];
  coinvestors: Coinvestor[];
  coinvestorCapitalTx: CoinvestorCapitalTx[];
  coinvestorProfitTx: CoinvestorProfitTx[];
  templates: MessageTemplate[];
  savedFilters: SavedFilter[];
  settings: { cashOpeningBalance: number; hiddenNavItems: string[]; clientDefaultLimit: number };
}

function toCapitalTx(row: CoinvestorCapitalRow): CoinvestorCapitalTx {
  return {
    id: String(row.id),
    coinvestorId: row.coinvestor_id,
    kind: row.kind,
    amount: row.amount,
    date: row.occurred_at,
    ...(row.note ? { note: row.note } : {}),
  };
}

function toProfitTx(row: CoinvestorProfitRow): CoinvestorProfitTx {
  return {
    id: String(row.id),
    coinvestorId: row.coinvestor_id,
    kind: row.kind,
    amount: row.amount,
    date: row.occurred_at.toISOString(),
    ...(row.deal_id ? { dealId: row.deal_id } : {}),
    ...(row.note ? { note: row.note } : {}),
  };
}

/**
 * Капитал, начисления и остаток к выплате — не хранятся отдельно, а
 * считаются из журналов при каждом чтении. Это меньше данных для
 * рассинхронизации: правда всегда в проводках, а не в кэширующем счётчике.
 */
function toCoinvestor(
  row: CoinvestorRow,
  capitalTx: CoinvestorCapitalTx[],
  profitTx: CoinvestorProfitTx[]
): Coinvestor {
  const ownCapital = capitalTx.filter((t) => t.coinvestorId === row.id);
  const ownProfit = profitTx.filter((t) => t.coinvestorId === row.id);

  const capital =
    ownCapital
      .filter((t) => t.kind === "deposit" || t.kind === "reinvest")
      .reduce((s, t) => s + t.amount, 0) -
    ownCapital
      .filter((t) => t.kind === "withdrawal")
      .reduce((s, t) => s + t.amount, 0);

  const accrued = ownProfit
    .filter((t) => t.kind === "accrual")
    .reduce((s, t) => s + t.amount, 0);
  const settled = ownProfit
    .filter((t) => t.kind === "payout" || t.kind === "reinvest")
    .reduce((s, t) => s + t.amount, 0);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    profitSharePct: row.profit_share_pct,
    startedAt: row.started_at,
    active: row.active,
    capital,
    accrued,
    settled,
    owed: accrued - settled,
  };
}

function toTemplate(row: TemplateRow): MessageTemplate {
  return {
    id: String(row.id),
    name: row.name,
    body: row.body,
    isDefault: row.is_default,
    ...(row.stage ? { stage: row.stage as MessageTemplate["stage"] } : {}),
  };
}

/** Клиент без персональных данных — для ролей, которым они не нужны по работе. */
function withoutPersonalData(c: Client): Client {
  return {
    id: c.id,
    name: c.name,
    phone: "—",
    email: "—",
    city: c.city,
    since: c.since,
    status: c.status,
    statusLabel: c.statusLabel,
    nextAction: c.nextAction,
    nextDate: c.nextDate,
    portalToken: "",
    ...(c.creditLimit !== undefined ? { creditLimit: c.creditLimit } : {}),
    ...(c.blacklistedAt ? { blacklistedAt: c.blacklistedAt } : {}),
  };
}

/**
 * Всё состояние компании одним запросом — прямая замена чтения localStorage.
 * При сотнях сделок это дешевле, чем множить запросы по страницам; когда
 * данных станет много, разделим по разделам.
 */
export async function loadBootstrap(
  dbName: string,
  currentUser: { id: number; name: string; initials: string; email: string; role: string }
): Promise<Bootstrap> {
  const today = todayIso();

  const [
    dealRows, clientRows, cashRows, eventRows, settingRows, userRows,
    coinvestorRows, capitalRows, profitRows, templateRows, savedFilters,
  ] =
    await Promise.all([
      query<DealRow>(dbName, DEALS_SQL),
      query<ClientRow>(dbName, "select * from clients order by created_at desc"),
      query<CashRow>(dbName, "select * from cash_tx order by occurred_at, id"),
      query<EventRow>(dbName, "select * from deal_events order by occurred_at desc"),
      query<{ key: string; value: unknown }>(dbName, "select key, value from settings"),
      query<{
        id: number; name: string; initials: string; email: string;
        phone: string | null; role: "admin" | "manager" | "accountant"; active: boolean;
        created_at: Date;
      }>(
        dbName,
        `select id, name, initials, email, phone, role, active, created_at
         from users order by active desc, name`
      ),
      query<CoinvestorRow>(dbName, "select * from coinvestors order by created_at desc"),
      query<CoinvestorCapitalRow>(
        dbName,
        "select * from coinvestor_capital_tx order by occurred_at desc, id desc"
      ),
      query<CoinvestorProfitRow>(
        dbName,
        "select * from coinvestor_profit_tx order by occurred_at desc, id desc"
      ),
      query<TemplateRow>(dbName, "select * from message_templates order by created_at"),
      listSavedFilters(dbName, currentUser.id),
    ]);

  // Данные по ролям. Меню прячет разделы, но в браузер приходит всё, что
  // отдал этот запрос, — поэтому лишнее отрезается здесь, а не в интерфейсе:
  //   соинвесторы (их капитал и доходы) — администратору и бухгалтеру;
  //   паспортные данные, адреса, ИНН и контакты клиентов — не бухгалтеру,
  //   ему для кассы и аналитики хватает имени.
  const seesInvestors = currentUser.role === "admin" || currentUser.role === "accountant";
  const seesPersonalData = currentUser.role !== "accountant";

  const coinvestorCapitalTx = seesInvestors ? capitalRows.map(toCapitalTx) : [];
  const coinvestorProfitTx = seesInvestors ? profitRows.map(toProfitTx) : [];

  const deals = dealRows.map((r) => toDeal(r, today));

  const paidPayments: Record<string, number> = {};
  for (const row of dealRows) paidPayments[row.id] = row.paid_count;

  const opening = settingRows.find((s) => s.key === "cash_opening_balance");
  const hiddenNav = settingRows.find((s) => s.key === "hidden_nav_items");
  const defaultLimit = settingRows.find((s) => s.key === "client_default_limit");

  return {
    user: currentUser,
    employees: userRows.map((u) => ({
      id: u.id,
      name: u.name,
      initials: u.initials,
      email: u.email,
      phone: u.phone ?? "—",
      role: u.role,
      since: sinceLabel(isoDate(u.created_at)),
      active: u.active,
    })),
    deals,
    clients: clientRows.map((r) => {
      const client = toClient(r, deals, today);
      return seesPersonalData ? client : withoutPersonalData(client);
    }),
    paidPayments,
    cash: cashRows.map((r) => ({
      id: String(r.id),
      kind: r.kind,
      amount: r.amount,
      date: r.occurred_at,
      title: r.title,
      ...(r.deal_id ? { dealId: r.deal_id } : {}),
      ...(r.coinvestor_id ? { coinvestorId: r.coinvestor_id } : {}),
      ...(r.note ? { note: r.note } : {}),
      ...(r.installment_number !== null ? { installmentNumber: r.installment_number } : {}),
      ...(r.reverses_id !== null ? { reversesId: String(r.reverses_id) } : {}),
    })),
    events: eventRows.map((r) => ({
      id: String(r.id),
      dealId: r.deal_id,
      date: isoDate(r.occurred_at),
      text: r.text,
    })),
    coinvestors: seesInvestors
      ? coinvestorRows.map((r) => toCoinvestor(r, coinvestorCapitalTx, coinvestorProfitTx))
      : [],
    coinvestorCapitalTx,
    coinvestorProfitTx,
    templates: templateRows.map(toTemplate),
    savedFilters,
    settings: {
      cashOpeningBalance: Number(opening?.value ?? 0),
      hiddenNavItems: Array.isArray(hiddenNav?.value) ? (hiddenNav.value as string[]) : [],
      // Ключа нет только до миграции 018 — тогда лимиты выключены
      clientDefaultLimit: Number(defaultLimit?.value ?? 0),
    },
  };
}

/** Разделы бокового меню, которые компания решила скрыть (см. app/settings). */
export async function setHiddenNavItems(dbName: string, hrefs: string[]): Promise<void> {
  await query(
    dbName,
    `insert into settings (key, value) values ('hidden_nav_items', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(hrefs)]
  );
}

async function loadDeal(dbName: string, id: string): Promise<Deal | undefined> {
  const row = await queryOne<DealRow>(dbName, DEAL_BY_ID_SQL, [id]);
  return row ? toDeal(row, todayIso()) : undefined;
}

// ── Запись ─────────────────────────────────────────────────────────────

export interface NewClientInput {
  lastName: string;
  firstName: string;
  middleName?: string;
  phone: string;
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: string;
  registrationAddress?: string;
  livingAddress?: string;
  inn?: string;
}

export async function createClient(
  dbName: string,
  input: NewClientInput
): Promise<Client> {
  const name = [input.lastName, input.firstName, input.middleName]
    .filter(Boolean)
    .join(" ");
  const row = await queryOne<ClientRow>(
    dbName,
    `insert into clients (
       name, phone, middle_name, birth_date, passport_series, passport_number,
       passport_issued_by, passport_issued_at, registration_address,
       living_address, inn
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      name,
      input.phone || "—",
      input.middleName || null,
      input.birthDate || null,
      input.passportSeries || null,
      input.passportNumber || null,
      input.passportIssuedBy || null,
      input.passportIssuedAt || null,
      input.registrationAddress || null,
      input.livingAddress || null,
      input.inn || null,
    ]
  );
  if (!row) throw new Error("Клиент не создан");
  return toClient(row, [], todayIso());
}

/** Ручной лимит клиента; null возвращает автоматический расчёт. */
export async function setClientCreditLimit(
  dbName: string,
  clientId: string,
  limit: number | null
): Promise<void> {
  const row = await queryOne<{ id: string }>(
    dbName,
    "update clients set credit_limit = $2 where id = $1 returning id",
    [clientId, limit]
  );
  if (!row) throw new Error(`Клиент ${clientId} не найден`);
}

export async function setClientDefaultLimit(dbName: string, limit: number): Promise<void> {
  await query(
    dbName,
    `insert into settings (key, value) values ('client_default_limit', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(limit)]
  );
}

export async function setClientBlacklisted(
  dbName: string,
  clientId: string,
  blacklisted: boolean,
  reason?: string
): Promise<void> {
  const row = await queryOne<{ id: string }>(
    dbName,
    blacklisted
      ? "update clients set blacklisted_at = now(), blacklist_reason = $2 where id = $1 returning id"
      : "update clients set blacklisted_at = null, blacklist_reason = null where id = $1 returning id",
    blacklisted ? [clientId, reason || null] : [clientId]
  );
  if (!row) throw new Error(`Клиент ${clientId} не найден`);
}

export interface NewDealInput {
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  clientId: string;
  managerId: number;
  markupPct: number;
  description?: string;
  category?: string;
  city?: string;
  /** id клиентов-поручителей — до 5, проверяется в API-роуте. */
  guarantorIds?: string[];
  downPayment?: number;
}

export async function createDeal(
  dbName: string,
  input: NewDealInput
): Promise<Deal> {
  const id = await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ id: string; product: string }>(
      `insert into deals (client_id, product, amount, months, markup_pct, opened_at,
                          manager_id, stage, description, category, city, down_payment)
       values ($1, $2, $3, $4, $5, $6,
               (select id from users where id = $7 and active), 'new', $8, $9, $10, $11)
       returning id, product`,
      [
        input.clientId,
        input.product,
        input.amount,
        input.months,
        input.markupPct,
        input.openedAt,
        input.managerId,
        input.description || null,
        input.category || null,
        input.city || null,
        input.downPayment || null,
      ]
    );
    const deal = rows[0];

    // Поручители — существующие клиенты компании, максимум 5 (проверено в API)
    if (input.guarantorIds && input.guarantorIds.length > 0) {
      for (const guarantorId of input.guarantorIds) {
        await client.query(
          `insert into deal_guarantors (deal_id, client_id) values ($1, $2)
           on conflict do nothing`,
          [deal.id, guarantorId]
        );
      }
    }

    // Закупка и первый взнос проводятся в кассу не здесь, а при выдаче —
    // переводе в «Активна» (issueDealCash): пока это заявка, деньги не
    // потрачены и не получены, и касса не должна их показывать

    const { rows: managerRows } = await client.query<{ name: string }>(
      "select name from users where id = $1",
      [input.managerId]
    );
    await client.query(
      `insert into deal_events (deal_id, text, user_id) values ($1, $2, $3)`,
      [
        deal.id,
        `Сделка создана · ответственный ${managerRows[0]?.name ?? "не назначен"}`,
        input.managerId,
      ]
    );

    return deal.id;
  });

  const created = await loadDeal(dbName, id);
  if (!created) throw new Error("Сделка создана, но не читается");
  return created;
}

export interface UpdateDealInput {
  product: string;
  nextStep: string;
  managerId: number;
  /** Сумму, срок и наценку можно менять, только пока по сделке нет ни одного взноса. */
  amount?: number;
  months?: number;
  markupPct?: number;
  /** undefined — не трогать, null — сбросить на общий шаблон компании. */
  reminderTemplateId?: string | null;
}

/**
 * Правки карточки сделки. Сумму/срок/наценку разрешаем менять только до
 * первого платежа: график строится из этих трёх чисел детерминированно
 * (buildSchedule), и после того как клиент уже что-то заплатил, менять их
 * задним числом значило бы переписывать историю платежей. Дедлайн подписания
 * тут не редактируется — в API он приходит отформатированной строкой
 * («6 августа»), а не ISO-датой, обратно её парсить ненадёжно.
 */
export async function updateDeal(
  dbName: string,
  dealId: string,
  input: UpdateDealInput
): Promise<Deal> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{
      paid_count: number;
      down_payment: number | null;
      manager_id: number | null;
    }>(
      "select paid_count, down_payment, manager_id from deals where id = $1 and deleted_at is null for update",
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);

    // Раньше отключённый сотрудник молча превращался в «без ответственного».
    // Оставить прежнего (даже отключённого) можно, назначить отключённого — нет
    if (input.managerId !== deal.manager_id) {
      const { rows: active } = await client.query(
        "select 1 from users where id = $1 and active",
        [input.managerId]
      );
      if (active.length === 0) throw new Error("MANAGER_NOT_FOUND");
    }

    const changingEconomics =
      input.amount !== undefined ||
      input.months !== undefined ||
      input.markupPct !== undefined;
    if (changingEconomics && deal.paid_count > 0) {
      throw new Error("ALREADY_PAID");
    }

    await client.query(
      "update deals set product = $2, next_step = $3, manager_id = $4 where id = $1",
      [dealId, input.product, input.nextStep || null, input.managerId]
    );

    if (input.reminderTemplateId !== undefined) {
      await client.query(
        "update deals set reminder_template_id = $2 where id = $1",
        [dealId, input.reminderTemplateId]
      );
    }

    if (changingEconomics) {
      await client.query(
        "update deals set amount = $2, months = $3, markup_pct = $4 where id = $1",
        [dealId, input.amount, input.months, input.markupPct]
      );

      // Закупка в кассе была посчитана от старой суммы/наценки — пересчитываем,
      // иначе касса разойдётся с фактической стоимостью сделки
      const purchase = purchasePrice(input.amount!, input.markupPct!, deal.down_payment ?? 0);
      await client.query(
        `update cash_tx set amount = $2, title = $3 where deal_id = $1 and kind = 'purchase'`,
        [dealId, -purchase, `Закупка товара · ${input.product}`]
      );
    } else {
      await client.query(
        `update cash_tx set title = $2 where deal_id = $1 and kind = 'purchase'`,
        [dealId, `Закупка товара · ${input.product}`]
      );
    }

    await client.query(
      "insert into deal_events (deal_id, text) values ($1, 'Данные сделки отредактированы')",
      [dealId]
    );
  });

  const updated = await loadDeal(dbName, dealId);
  if (!updated) throw new Error(`Сделка ${dealId} не найдена`);
  return updated;
}

const KANBAN_STAGES = new Set<DealStage>(["new", "check", "active"]);

/** Запись кассы о первом взносе — без номера взноса, узнаётся по заголовку. */
const DOWN_PAYMENT_SQL = `kind = 'payment' and installment_number is null and title like 'Первоначальный взнос%'`;

/**
 * Выдача сделки: закупка товара уходит из кассы, первый взнос приходит.
 * Проводится один раз — у сделок, созданных до этого правила, обе записи
 * уже есть с момента создания заявки.
 */
async function issueDealCash(client: PoolClient, dealId: string): Promise<void> {
  const { rows } = await client.query<{
    amount: number;
    markup_pct: number;
    down_payment: number | null;
    product: string;
    client_name: string;
  }>(
    `select d.amount, d.markup_pct, d.down_payment, d.product, c.name as client_name
     from deals d join clients c on c.id = d.client_id where d.id = $1`,
    [dealId]
  );
  const deal = rows[0];
  if (!deal) return;
  const today = todayIso();

  const { rows: has } = await client.query<{ purchase: boolean; down: boolean }>(
    `select exists (select 1 from cash_tx where deal_id = $1 and kind = 'purchase') as purchase,
            exists (select 1 from cash_tx where deal_id = $1 and ${DOWN_PAYMENT_SQL}) as down`,
    [dealId]
  );
  if (!has[0].purchase) {
    const purchase = purchasePrice(deal.amount, deal.markup_pct, deal.down_payment ?? 0);
    await client.query(
      `insert into cash_tx (kind, amount, occurred_at, deal_id, title, note)
       values ('purchase', $1, $2, $3, $4, $5)`,
      [-purchase, today, dealId, `Закупка товара · ${deal.product}`, deal.client_name]
    );
  }
  if (deal.down_payment && !has[0].down) {
    await client.query(
      `insert into cash_tx (kind, amount, occurred_at, deal_id, title, note)
       values ('payment', $1, $2, $3, $4, $5)`,
      [deal.down_payment, today, dealId, `Первоначальный взнос · ${deal.product}`, deal.client_name]
    );
  }
}

/**
 * Обратное к issueDealCash — для сделки без единого платежа по графику,
 * которую вернули в заявки, отклонили или удалили: закупки не было,
 * первого взноса тоже.
 */
async function unissueDealCash(client: PoolClient, dealId: string): Promise<void> {
  await client.query(
    `delete from cash_tx where deal_id = $1 and (kind = 'purchase' or (${DOWN_PAYMENT_SQL}))`,
    [dealId]
  );
}

/**
 * Перетаскивание карточки между колонками канбана. Только между new/check/
 * active — закрытие и отказ идут через свои действия (closeDealEarly и
 * т.п.), у них своя логика (списание кассы, финализация), которую нельзя
 * просто подменить перетаскиванием.
 */
export async function setDealStage(
  dbName: string,
  dealId: string,
  stage: DealStage
): Promise<Deal> {
  if (!KANBAN_STAGES.has(stage)) {
    throw new Error("BAD_STAGE");
  }

  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ stage: DealStage; paid_count: number }>(
      "select stage, paid_count from deals where id = $1 for update",
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    // «Подписание» на канбане не показывается, но выдать такую заявку можно
    if (!KANBAN_STAGES.has(deal.stage) && deal.stage !== "signing") {
      throw new Error("BAD_STAGE");
    }
    if (deal.stage === stage) return;

    // Платежи уже приняты по графику — увести карточку из «Активна» назад
    // значило бы потерять смысл графика, который уже пошёл по датам
    if (deal.paid_count > 0 && stage !== "active") {
      throw new Error("HAS_PAYMENTS");
    }

    await client.query("update deals set stage = $2 where id = $1", [dealId, stage]);
    if (stage === "active") await issueDealCash(client, dealId);
    else if (deal.stage === "active") await unissueDealCash(client, dealId);

    const stageTitle = stages.find((s) => s.key === stage)?.title ?? stage;
    await client.query(
      "insert into deal_events (deal_id, text) values ($1, $2)",
      [dealId, `Этап изменён на «${stageTitle}»`]
    );
  });

  const updated = await loadDeal(dbName, dealId);
  if (!updated) throw new Error(`Сделка ${dealId} не найдена`);
  return updated;
}

/** Смена ответственного одним действием — без похода в полное редактирование сделки. */
export async function reassignDeal(
  dbName: string,
  dealId: string,
  managerId: number
): Promise<Deal> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      "select name from users where id = $1 and active",
      [managerId]
    );
    const manager = rows[0];
    if (!manager) throw new Error("MANAGER_NOT_FOUND");

    const updated = await client.query(
      "update deals set manager_id = $2 where id = $1 returning id",
      [dealId, managerId]
    );
    if (updated.rows.length === 0) throw new Error(`Сделка ${dealId} не найдена`);

    await client.query(
      "insert into deal_events (deal_id, text) values ($1, $2)",
      [dealId, `Ответственный изменён на ${manager.name}`]
    );
  });

  const deal = await loadDeal(dbName, dealId);
  if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
  return deal;
}

/**
 * Досрочное закрытие: клиент разом гасит остаток (не через график по
 * взносам), сделка сразу закрывается. Остаток проводится в кассу одной
 * суммой и с него тоже начисляется доля соинвесторам — иначе на последнем
 * куске маржи никто бы ничего не получил.
 */
export async function closeDealEarly(
  dbName: string,
  dealId: string
): Promise<Deal> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{
      amount: number;
      months: number;
      markup_pct: number;
      down_payment: number | null;
      paid_count: number;
      credit: number;
      opened_at: string;
      original_months: number | null;
      restructured_months: number | null;
      restructured_from: string | null;
      stage: DealStage;
      product: string;
      client_name: string;
    }>(
      `select d.amount, d.months, d.markup_pct, d.down_payment, d.paid_count, d.credit, d.opened_at,
              d.original_months, d.restructured_months, d.restructured_from,
              d.stage, d.product, c.name as client_name
       from deals d join clients c on c.id = d.client_id
       where d.id = $1
       for update of d`,
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    if (deal.stage !== "active") throw new Error("NOT_ACTIVE");

    // Не amount/months «в лоб» — после реструктуризации взносы неравные,
    // а последний взнос графика вообще забирает остаток округления
    const restructure = restructureOf({
      originalMonths: deal.original_months,
      restructuredMonths: deal.restructured_months,
      restructuredFrom: deal.restructured_from,
    });
    const schedule = buildSchedule(
      deal.amount,
      deal.months,
      deal.paid_count,
      deal.opened_at,
      restructure
    );
    const paidSum = schedule
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    // Уже внесённое в счёт следующего взноса — часть остатка, второй раз не берём
    const remaining = Math.round((deal.amount - paidSum - Number(deal.credit)) * 100) / 100;

    if (remaining > 0) {
      await client.query(
        `insert into cash_tx (kind, amount, occurred_at, deal_id, title, note)
         values ('payment', $1, $5, $2, $3, $4)`,
        [
          remaining,
          dealId,
          `Досрочное погашение остатка · ${deal.client_name}`,
          deal.product,
          todayIso(),
        ]
      );

      const purchase = purchasePrice(deal.amount, deal.markup_pct, deal.down_payment ?? 0);
      const totalMargin = deal.amount + (deal.down_payment ?? 0) - purchase;
      const remainingMargin = Math.round((totalMargin * (deal.months - deal.paid_count)) / deal.months);
      if (remainingMargin > 0) {
        const { rows: investors } = await client.query<{ id: string; profit_share_pct: number }>(
          "select id, profit_share_pct from coinvestors where active"
        );
        for (const investor of investors) {
          const share = (remainingMargin * investor.profit_share_pct) / 100;
          if (share <= 0) continue;
          await client.query(
            `insert into coinvestor_profit_tx (coinvestor_id, deal_id, kind, amount, note)
             values ($1, $2, 'accrual', $3, $4)`,
            [investor.id, dealId, share, `Доля с досрочного погашения · ${deal.product}`]
          );
        }
      }
    }

    await client.query(
      "update deals set paid_count = $2, credit = 0, stage = 'closed' where id = $1",
      [dealId, deal.months]
    );

    await client.query(
      "insert into deal_events (deal_id, text) values ($1, $2)",
      [
        dealId,
        remaining > 0
          ? `Сделка закрыта досрочно — остаток ${remaining.toLocaleString("ru-RU")} ₽ погашен одним платежом`
          : "Сделка закрыта досрочно",
      ]
    );
  });

  const deal = await loadDeal(dbName, dealId);
  if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
  return deal;
}

/**
 * Мягкое удаление: только для ошибочно созданных сделок без единого
 * платежа. Закупка в кассе для такой сделки тоже не должна была
 * происходить — удаляем её вместе со сделкой, а не оставляем висеть.
 */
export async function deleteDeal(dbName: string, dealId: string): Promise<void> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ paid_count: number }>(
      "select paid_count from deals where id = $1 and deleted_at is null for update",
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    if (deal.paid_count > 0) throw new Error("HAS_PAYMENTS");

    // Без единого платежа по графику — значит, и закупки с первым взносом
    // по ней на самом деле не было (раньше первый взнос оставался в кассе)
    await unissueDealCash(client, dealId);
    await client.query("update deals set deleted_at = now() where id = $1", [dealId]);
  });
}

/**
 * Отказ по заявке: этап «Отклонена» с причиной (видна в аналитике
 * «Причины отказов»). Только для заявок — выданную сделку с графиком
 * отклонить нельзя, её закрывают или реструктурируют.
 */
export async function rejectDeal(dbName: string, dealId: string, reason: string): Promise<Deal> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ stage: DealStage; paid_count: number }>(
      "select stage, paid_count from deals where id = $1 and deleted_at is null for update",
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    if (deal.stage === "rejected") return;
    if (deal.stage === "closed" || deal.paid_count > 0) throw new Error("HAS_PAYMENTS");

    await unissueDealCash(client, dealId);
    await client.query(
      "update deals set stage = 'rejected', reject_reason = $2, next_step = null where id = $1",
      [dealId, reason]
    );
    await client.query("insert into deal_events (deal_id, text) values ($1, $2)", [
      dealId,
      `Заявка отклонена: ${reason}`,
    ]);
  });

  const deal = await loadDeal(dbName, dealId);
  if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
  return deal;
}

export interface RestructureDealInput {
  /** На сколько месяцев растянуть остаток долга. */
  months: number;
  /** Дата первого взноса по новому графику. */
  from: string;
  reason: string;
  comment?: string;
}

/**
 * Реструктуризация: остаток долга на сегодня размазывается по новому
 * графику из input.months месяцев начиная с input.from. Уже оплаченные
 * взносы не трогаются — deals.months становится paid_count + input.months,
 * а original_months хранит прежнее значение, чтобы buildSchedule мог
 * корректно восстановить суммы взносов, оплаченных ещё по старому графику.
 */
export async function restructureDeal(
  dbName: string,
  dealId: string,
  input: RestructureDealInput
): Promise<Deal> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{
      months: number;
      paid_count: number;
      stage: DealStage;
    }>(
      "select months, paid_count, stage from deals where id = $1 for update",
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    if (deal.stage !== "active") throw new Error("NOT_ACTIVE");

    const newTotalMonths = deal.paid_count + input.months;
    await client.query(
      `update deals
       set months = $2, original_months = $3, restructured_months = $4, restructured_from = $5
       where id = $1`,
      [dealId, newTotalMonths, deal.months, input.months, input.from]
    );

    await client.query(
      "insert into deal_events (deal_id, text) values ($1, $2)",
      [
        dealId,
        `График изменён: остаток на ${input.months} мес. с ${input.from} · ${input.reason}` +
          (input.comment ? ` — ${input.comment}` : ""),
      ]
    );
  });

  const updated = await loadDeal(dbName, dealId);
  if (!updated) throw new Error(`Сделка ${dealId} не найдена`);
  return updated;
}

/**
 * Принимает платёж: распределяет сумму по взносам, приходует деньги в
 * кассу и пишет события в историю — одной транзакцией.
 *
 * `for update` держит строку до конца транзакции: без него два менеджера,
 * нажавшие «Принять платёж» одновременно, засчитали бы два взноса вместо
 * одного. В версии на localStorage такой защиты не было в принципе.
 */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "наличные",
  card: "карта",
  transfer: "перевод",
};

export interface AcceptPaymentOptions {
  /** Фактическая дата поступления денег — по умолчанию сегодня. */
  date?: string;
  method?: "cash" | "card" | "transfer";
  /**
   * Фактически внесённая сумма — по умолчанию то, что осталось внести по
   * ближайшему взносу. Больше — закрывает следующие взносы, меньше —
   * частичная оплата; остаток в обоих случаях копится в deals.credit
   * (lib/payments.ts). Больше всего долга принять нельзя.
   */
  amount?: number;
}

export async function acceptPayment(
  dbName: string,
  dealId: string,
  options: AcceptPaymentOptions = {}
): Promise<{ deal: Deal; alreadyPaid: boolean; received: number; installments: number[]; credit: number }> {
  const occurredAt = options.date ?? todayIso();
  const methodLabel = options.method ? PAYMENT_METHOD_LABEL[options.method] : undefined;
  // Что реально провели — для журнала действий: полностью закрытые взносы
  let received = 0;
  const installments: number[] = [];
  let creditAfter = 0;

  const alreadyPaid = await transaction(dbName, async (client) => {
    const { rows } = await client.query<{
      id: string;
      amount: number;
      months: number;
      markup_pct: number;
      down_payment: number | null;
      paid_count: number;
      credit: number;
      stage: DealStage;
      opened_at: string;
      product: string;
      client_name: string;
      original_months: number | null;
      restructured_months: number | null;
      restructured_from: string | null;
    }>(
      `select d.id, d.amount, d.months, d.markup_pct, d.down_payment, d.paid_count, d.credit,
              d.stage, d.opened_at, d.product, c.name as client_name,
              d.original_months, d.restructured_months, d.restructured_from
       from deals d join clients c on c.id = d.client_id
       where d.id = $1 and d.deleted_at is null
       for update of d`,
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    if (deal.paid_count >= deal.months) return true;
    // Платёж принимается только по выданной сделке: заявку сначала
    // одобряют (перевод в «Активна» на канбане — там же проводится закупка),
    // а не активируют случайным нажатием «Принять платёж»
    if (deal.stage !== "active") throw new Error("NOT_ACTIVE");

    const restructure = restructureOf({
      originalMonths: deal.original_months,
      restructuredMonths: deal.restructured_months,
      restructuredFrom: deal.restructured_from,
    });
    // Суммы по графику не зависят от paid — берём весь график один раз
    const amounts = buildSchedule(deal.amount, deal.months, deal.months, deal.opened_at, restructure)
      .map((p) => p.amount);

    const credit = Number(deal.credit);
    const allocation = allocatePayment(
      amounts,
      deal.paid_count,
      credit,
      options.amount ?? nextDue(amounts, deal.paid_count, credit)
    );
    if (!allocation.ok) {
      throw new PaymentAmountError(allocation.error, allocation.max);
    }

    await client.query(
      `update deals set paid_count = $2, credit = $3,
              stage = case when $2 >= months then 'closed' else stage end
       where id = $1`,
      [dealId, allocation.paid, allocation.credit]
    );
    creditAfter = allocation.credit;

    // По одной записи в кассу на каждый взнос, которого коснулся платёж —
    // так «Отменить последний платёж» откатывает ровно одну запись, а
    // квитанция и история показывают, за какой взнос пришли деньги.
    for (const part of allocation.parts) {
      received += part.amount;
      const n = part.installment;
      const what = part.completes
        ? `Платёж ${n} из ${deal.months}`
        : `Частичная оплата взноса ${n} из ${deal.months}`;

      // Дата операции — по умолчанию сегодня, а НЕ плановая дата взноса:
      // клиент может гасить июльский платёж в августе. Менеджер может явно
      // указать другую дату (options.date), если заносит платёж задним числом.
      await client.query(
        `insert into cash_tx (kind, amount, occurred_at, deal_id, title, note, installment_number, method)
         values ('payment', $1, $2, $3, $4, $5, $6, $7)`,
        [
          part.amount,
          occurredAt,
          dealId,
          `${what} · ${deal.client_name}`,
          methodLabel ? `${deal.product} · ${methodLabel}` : deal.product,
          n,
          options.method ?? null,
        ]
      );

      await client.query(
        "insert into deal_events (deal_id, text) values ($1, $2)",
        [
          dealId,
          `${what} — ${part.amount.toLocaleString("ru-RU")} ₽` +
            (part.completes ? " · взнос закрыт" : "") +
            (methodLabel ? ` · ${methodLabel}` : ""),
        ]
      );

      // Долю соинвесторам начисляем, когда взнос закрыт целиком: доля
      // считается от маржи взноса, а не от случайной части платежа
      if (part.completes) {
        installments.push(n);
        await accrueCoinvestorProfit(
          client,
          dealId,
          deal.amount,
          deal.months,
          deal.markup_pct,
          deal.product,
          n,
          deal.down_payment ?? 0
        );
      }
    }

    return false;
  });

  const deal = await loadDeal(dbName, dealId);
  if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
  return { deal, alreadyPaid, received, installments, credit: creditAfter };
}

/** Сумма платежа не подходит: не больше нуля или больше остатка долга (max). */
export class PaymentAmountError extends Error {
  constructor(
    public readonly reason: "NOT_POSITIVE" | "TOO_HIGH",
    public readonly max: number
  ) {
    super(reason);
    this.name = "PaymentAmountError";
  }
}

/**
 * Отменяет последнюю принятую запись о платеже по сделке — менеджер
 * ошибся суммой или сделкой. Отменяется одна запись кассы за раз (полный
 * взнос или его часть), в обратном порядке; состояние графика после этого
 * пересчитывается по оставшимся платежам (stateFromPayments).
 *
 * Реальные деньги (cash_tx) не удаляются задним числом — добавляется
 * компенсирующая запись, чтобы в кассе остался полный аудиторский след.
 * Начисление соинвесторам за взнос, который снова стал неоплаченным,
 * удаляется: это ещё не выплаченные деньги, просто прогноз.
 */
export async function undoLastPayment(
  dbName: string,
  dealId: string
): Promise<{ deal: Deal; installment: number; amount: number }> {
  const undone = await transaction(dbName, async (client) => {
    const { rows } = await client.query<{
      amount: number;
      months: number;
      paid_count: number;
      credit: number;
      opened_at: string;
      original_months: number | null;
      restructured_months: number | null;
      restructured_from: string | null;
      product: string;
      client_name: string;
    }>(
      `select d.amount, d.months, d.paid_count, d.credit, d.opened_at,
              d.original_months, d.restructured_months, d.restructured_from,
              d.product, c.name as client_name
       from deals d join clients c on c.id = d.client_id
       where d.id = $1 and d.deleted_at is null
       for update of d`,
      [dealId]
    );
    const deal = rows[0];
    if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
    if (deal.paid_count <= 0 && Number(deal.credit) <= 0) throw new Error("NOTHING_TO_UNDO");

    // Действующие (не отменённые) записи о взносах. Запись-отмену берём
    // по reverses_id, а не «последнюю запись по сделке» — иначе второй
    // откат подряд «отменял бы отмену»
    const { rows: payments } = await client.query<{ id: string; amount: number; installment_number: number }>(
      `select p.id, p.amount, p.installment_number from cash_tx p
       where p.deal_id = $1 and p.kind = 'payment' and p.installment_number is not null
         and p.amount > 0 and p.reverses_id is null
         and not exists (select 1 from cash_tx r where r.reverses_id = p.id)
       order by p.id`,
      [dealId]
    );
    const lastTx = payments[payments.length - 1];
    // Нет записи — взносы закрыты не отдельными платежами (досрочное
    // погашение одной суммой) или это данные до связи платёж ↔ взнос
    if (!lastTx) throw new Error("NO_PAYMENT_RECORD");
    const n = lastTx.installment_number;

    await client.query(
      `insert into cash_tx (kind, amount, occurred_at, deal_id, title, note, installment_number, reverses_id)
       values ('payment', $1, $2, $3, $4, $5, $6, $7)`,
      [
        -lastTx.amount,
        todayIso(),
        dealId,
        `Отмена платежа по взносу ${n} из ${deal.months} · ${deal.client_name}`,
        deal.product,
        n,
        lastTx.id,
      ]
    );

    const restructure = restructureOf({
      originalMonths: deal.original_months,
      restructuredMonths: deal.restructured_months,
      restructuredFrom: deal.restructured_from,
    });
    const amounts = buildSchedule(deal.amount, deal.months, deal.months, deal.opened_at, restructure)
      .map((p) => p.amount);
    const state = stateFromPayments(
      amounts,
      payments.slice(0, -1).map((p) => ({ installment: p.installment_number, amount: Number(p.amount) }))
    );

    // Взносы, которые снова стали неоплаченными, — без доли соинвесторам
    if (state.paid < deal.paid_count) {
      await client.query(
        `delete from coinvestor_profit_tx
         where deal_id = $1 and kind = 'accrual' and installment_number > $2 and installment_number <= $3`,
        [dealId, state.paid, deal.paid_count]
      );
    }

    await client.query(
      `update deals set paid_count = $2, credit = $3,
              stage = case when stage = 'closed' then 'active' else stage end
       where id = $1`,
      [dealId, state.paid, state.credit]
    );

    await client.query(
      "insert into deal_events (deal_id, text) values ($1, $2)",
      [
        dealId,
        `Платёж ${Number(lastTx.amount).toLocaleString("ru-RU")} ₽ по взносу ${n} из ${deal.months} отменён — принят по ошибке`,
      ]
    );

    return { installment: n, amount: Number(lastTx.amount) };
  });

  const updated = await loadDeal(dbName, dealId);
  if (!updated) throw new Error(`Сделка ${dealId} не найдена`);
  return { deal: updated, ...undone };
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

// ── Соинвесторы ────────────────────────────────────────────────────────
//
// Модель: доля соинвестора — процент от РЕАЛЬНОЙ прибыли кассы, а не от
// вложенной суммы. Прибыль начисляется автоматически с каждого принятого
// платежа (см. вызов accrueCoinvestorProfit внутри acceptPayment), пропорционально
// марже конкретной сделки. Капитал — отдельный журнал (пополнение / снятие /
// реинвестирование), а не статичное поле: так видно, откуда взялась каждая сумма.

async function loadCoinvestor(dbName: string, id: string): Promise<Coinvestor> {
  const row = await queryOne<CoinvestorRow>(
    dbName,
    "select * from coinvestors where id = $1",
    [id]
  );
  if (!row) throw new Error(`Соинвестор ${id} не найден`);

  const [capitalRows, profitRows] = await Promise.all([
    query<CoinvestorCapitalRow>(
      dbName,
      "select * from coinvestor_capital_tx where coinvestor_id = $1",
      [id]
    ),
    query<CoinvestorProfitRow>(
      dbName,
      "select * from coinvestor_profit_tx where coinvestor_id = $1",
      [id]
    ),
  ]);

  return toCoinvestor(row, capitalRows.map(toCapitalTx), profitRows.map(toProfitTx));
}

/**
 * Начисляет долю прибыли всем активным соинвесторам с одного принятого
 * платежа. Вызывается изнутри транзакции acceptPayment — маржа сделки
 * (amount - purchase) размазана поровну по всем взносам, поэтому доля с
 * каждого платежа одинакова независимо от того, какой он по счёту.
 */
async function accrueCoinvestorProfit(
  client: PoolClient,
  dealId: string,
  dealAmount: number,
  months: number,
  markupPct: number,
  product: string,
  installmentNumber: number,
  downPayment = 0
): Promise<void> {
  const purchase = purchasePrice(dealAmount, markupPct, downPayment);
  const totalMargin = dealAmount + downPayment - purchase;
  const marginPerInstallment = totalMargin / months;
  if (marginPerInstallment <= 0) return;

  const { rows: investors } = await client.query<{ id: string; name: string; profit_share_pct: number }>(
    "select id, name, profit_share_pct from coinvestors where active"
  );

  for (const investor of investors) {
    const share = (marginPerInstallment * investor.profit_share_pct) / 100;
    if (share <= 0) continue;
    await client.query(
      `insert into coinvestor_profit_tx (coinvestor_id, deal_id, kind, amount, note, installment_number)
       values ($1, $2, 'accrual', $3, $4, $5)`,
      [investor.id, dealId, share, `Доля с платежа ${installmentNumber} из ${months} · ${product}`, installmentNumber]
    );
  }
}

export interface NewCoinvestorInput {
  name: string;
  phone: string;
  profitSharePct: number;
  startedAt: string;
  /** Необязательный стартовый взнос — если указан, сразу заводит запись в журнале капитала. */
  openingCapital?: number;
}

export async function createCoinvestor(
  dbName: string,
  input: NewCoinvestorInput
): Promise<Coinvestor> {
  const id = await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `insert into coinvestors (name, phone, profit_share_pct, started_at)
       values ($1, $2, $3, $4)
       returning id`,
      [input.name, input.phone || "—", input.profitSharePct, input.startedAt]
    );
    const coinvestorId = rows[0].id;

    if (input.openingCapital && input.openingCapital > 0) {
      await client.query(
        `insert into coinvestor_capital_tx (coinvestor_id, kind, amount, occurred_at, note)
         values ($1, 'deposit', $2, $3, 'Стартовый капитал')`,
        [coinvestorId, input.openingCapital, input.startedAt]
      );
      await client.query(
        `insert into cash_tx (kind, amount, occurred_at, coinvestor_id, title)
         values ('capital_deposit', $1, $2, $3, $4)`,
        [input.openingCapital, input.startedAt, coinvestorId, `Пополнение капитала · ${input.name}`]
      );
    }

    return coinvestorId;
  });

  return loadCoinvestor(dbName, id);
}

export interface UpdateCoinvestorInput {
  name: string;
  phone: string;
  profitSharePct: number;
}

export async function updateCoinvestor(
  dbName: string,
  id: string,
  input: UpdateCoinvestorInput
): Promise<Coinvestor> {
  const row = await queryOne<{ id: string }>(
    dbName,
    "update coinvestors set name = $2, phone = $3, profit_share_pct = $4 where id = $1 returning id",
    [id, input.name, input.phone || "—", input.profitSharePct]
  );
  if (!row) throw new Error(`Соинвестор ${id} не найден`);
  return loadCoinvestor(dbName, id);
}

export async function setCoinvestorActive(
  dbName: string,
  id: string,
  active: boolean
): Promise<void> {
  const row = await queryOne<{ id: string }>(
    dbName,
    "update coinvestors set active = $2 where id = $1 returning id",
    [id, active]
  );
  if (!row) throw new Error(`Соинвестор ${id} не найден`);
}

/**
 * Удаляет соинвестора целиком — только если по нему нет финансовой истории
 * (капитал уже снят до нуля, начисления выплачены/реинвестированы). Иначе
 * пропала бы часть бухгалтерии кассы без следа.
 */
export async function deleteCoinvestor(dbName: string, id: string): Promise<void> {
  const investor = await loadCoinvestor(dbName, id);
  if (investor.capital !== 0 || investor.owed !== 0) {
    throw new Error("HAS_HISTORY");
  }
  await query(dbName, "delete from coinvestors where id = $1", [id]);
}

export interface CoinvestorPayoutInput {
  amount: number;
  date: string;
}

/** Выплата начисленной прибыли деньгами — реальный расход из кассы. */
export async function recordCoinvestorPayout(
  dbName: string,
  coinvestorId: string,
  input: CoinvestorPayoutInput
): Promise<Coinvestor> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      "select name from coinvestors where id = $1",
      [coinvestorId]
    );
    const investor = rows[0];
    if (!investor) throw new Error(`Соинвестор ${coinvestorId} не найден`);

    const amount = Math.abs(input.amount);
    await client.query(
      `insert into cash_tx (kind, amount, occurred_at, coinvestor_id, title)
       values ('payout', $1, $2, $3, $4)`,
      [-amount, input.date, coinvestorId, `Выплата прибыли · ${investor.name}`]
    );
    await client.query(
      `insert into coinvestor_profit_tx (coinvestor_id, kind, amount, occurred_at, note)
       values ($1, 'payout', $2, $3, 'Выплата деньгами')`,
      [coinvestorId, amount, input.date]
    );
  });

  return loadCoinvestor(dbName, coinvestorId);
}

export interface CoinvestorReinvestInput {
  amount: number;
  date: string;
}

/**
 * Начисленное превращается в капитал без движения денег в кассе — сумма и
 * так уже лежит в кассе (пришла с платежами клиентов), просто меняет
 * назначение с «долг инвестору» на «его вложение».
 */
export async function reinvestCoinvestorProfit(
  dbName: string,
  coinvestorId: string,
  input: CoinvestorReinvestInput
): Promise<Coinvestor> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query("select id from coinvestors where id = $1", [coinvestorId]);
    if (!rows[0]) throw new Error(`Соинвестор ${coinvestorId} не найден`);

    const amount = Math.abs(input.amount);
    await client.query(
      `insert into coinvestor_profit_tx (coinvestor_id, kind, amount, occurred_at, note)
       values ($1, 'reinvest', $2, $3, 'Реинвестирование прибыли')`,
      [coinvestorId, amount, input.date]
    );
    await client.query(
      `insert into coinvestor_capital_tx (coinvestor_id, kind, amount, occurred_at, note)
       values ($1, 'reinvest', $2, $3, 'Из начисленной прибыли')`,
      [coinvestorId, amount, input.date]
    );
  });

  return loadCoinvestor(dbName, coinvestorId);
}

export interface CoinvestorCapitalInput {
  direction: "deposit" | "withdrawal";
  amount: number;
  date: string;
  note?: string;
}

/** Пополнение или снятие капитала — реальное движение денег в кассе компании. */
export async function adjustCoinvestorCapital(
  dbName: string,
  coinvestorId: string,
  input: CoinvestorCapitalInput
): Promise<Coinvestor> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      "select name from coinvestors where id = $1",
      [coinvestorId]
    );
    const investor = rows[0];
    if (!investor) throw new Error(`Соинвестор ${coinvestorId} не найден`);

    if (input.direction === "withdrawal") {
      const { rows: capRows } = await client.query<{ capital: string }>(
        `select coalesce(sum(case when kind = 'withdrawal' then -amount else amount end), 0) as capital
         from coinvestor_capital_tx where coinvestor_id = $1`,
        [coinvestorId]
      );
      if (Number(capRows[0].capital) < input.amount) {
        throw new Error("NOT_ENOUGH_CAPITAL");
      }
    }

    const kind = input.direction === "deposit" ? "deposit" : "withdrawal";
    const cashKind = input.direction === "deposit" ? "capital_deposit" : "capital_withdrawal";
    const cashAmount = input.direction === "deposit" ? input.amount : -input.amount;
    const label = input.direction === "deposit" ? "Пополнение капитала" : "Снятие капитала";

    await client.query(
      `insert into coinvestor_capital_tx (coinvestor_id, kind, amount, occurred_at, note)
       values ($1, $2, $3, $4, $5)`,
      [coinvestorId, kind, input.amount, input.date, input.note ?? null]
    );
    await client.query(
      `insert into cash_tx (kind, amount, occurred_at, coinvestor_id, title, note)
       values ($1, $2, $3, $4, $5, $6)`,
      [cashKind, cashAmount, input.date, coinvestorId, `${label} · ${investor.name}`, input.note ?? null]
    );
  });

  return loadCoinvestor(dbName, coinvestorId);
}

// ── Шаблоны сообщений ──────────────────────────────────────────────────
// Отправка идёт вручную через WhatsApp (wa.me) — своей интеграции с
// WhatsApp Business API у компании нет. Шаблон только подставляет текст;
// сам переход в WhatsApp и логирование факта отправки — на клиенте
// (см. POST /api/deals/[id]/remind).

export interface TemplateInput {
  name: string;
  body: string;
  stage?: string | null;
}

export async function createTemplate(
  dbName: string,
  input: TemplateInput
): Promise<MessageTemplate> {
  return transaction(dbName, async (client) => {
    // Стадия — одна на шаблон: снимаем её с прежнего владельца, если был
    if (input.stage) {
      await client.query("update message_templates set stage = null where stage = $1", [
        input.stage,
      ]);
    }
    const { rows } = await client.query<TemplateRow>(
      `insert into message_templates (name, body, stage) values ($1, $2, $3) returning *`,
      [input.name, input.body, input.stage ?? null]
    );
    if (!rows[0]) throw new Error("Шаблон не создан");
    return toTemplate(rows[0]);
  });
}

export async function updateTemplate(
  dbName: string,
  id: string,
  input: TemplateInput
): Promise<MessageTemplate> {
  return transaction(dbName, async (client) => {
    if (input.stage) {
      await client.query(
        "update message_templates set stage = null where stage = $1 and id != $2",
        [input.stage, id]
      );
    }
    const { rows } = await client.query<TemplateRow>(
      `update message_templates set name = $2, body = $3, stage = $4 where id = $1 returning *`,
      [id, input.name, input.body, input.stage ?? null]
    );
    if (!rows[0]) throw new Error(`Шаблон ${id} не найден`);
    return toTemplate(rows[0]);
  });
}

export async function deleteTemplate(dbName: string, id: string): Promise<void> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query<{ is_default: boolean }>(
      "delete from message_templates where id = $1 returning is_default",
      [id]
    );
    if (!rows[0]) throw new Error(`Шаблон ${id} не найден`);

    // Без шаблона по умолчанию некому будет собрать текст напоминания —
    // назначаем ближайший оставшийся, если удалили именно основной
    if (rows[0].is_default) {
      await client.query(
        `update message_templates set is_default = true
         where id = (select id from message_templates order by created_at limit 1)`
      );
    }
  });
}

export async function setDefaultTemplate(dbName: string, id: string): Promise<void> {
  await transaction(dbName, async (client) => {
    const { rows } = await client.query("select id from message_templates where id = $1", [id]);
    if (!rows[0]) throw new Error(`Шаблон ${id} не найден`);
    await client.query("update message_templates set is_default = false");
    await client.query("update message_templates set is_default = true where id = $1", [id]);
  });
}

/** Записывает в историю сделки факт отправки напоминания — сам переход в WhatsApp уже произошёл на клиенте. */
export async function recordReminderSent(
  dbName: string,
  dealId: string,
  stageInfo?: { stage: string; dueDate: string }
): Promise<void> {
  const deal = await queryOne<{ id: string }>(dbName, "select id from deals where id = $1", [dealId]);
  if (!deal) throw new Error(`Сделка ${dealId} не найдена`);
  await query(
    dbName,
    "insert into deal_events (deal_id, text) values ($1, 'Напоминание об оплате отправлено в WhatsApp')",
    [dealId]
  );
  if (stageInfo) {
    await query(
      dbName,
      "update deals set last_reminder_stage = $2, last_reminder_due_date = $3 where id = $1",
      [dealId, stageInfo.stage, stageInfo.dueDate]
    );
  }
}

// ── Кабинет клиента ────────────────────────────────────────────────────

export interface PortalDeal {
  id: string;
  clientFirstName: string;
  payments: PortalPayment[];
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  paid: number;
  /** Внесено в счёт следующего взноса (lib/payments.ts). */
  credit: number;
  managerName: string;
  managerPhone: string | null;
  originalMonths?: number;
  restructuredMonths?: number;
  restructuredFrom?: string;
}

/**
 * Данные для страницы /pay/<token>. Отдаём РОВНО одну сделку и ничего
 * больше: заёмщик открывает её по ссылке без всякой авторизации.
 *
 * Раньше кабинет вызывал useData() и получал в браузер все сделки и всех
 * клиентов компании — то есть любой заёмщик мог прочитать персональные
 * данные остальных. Наценка и закупочная цена сюда тоже не попадают:
 * это внутренняя экономика компании, клиенту её знать незачем.
 */
export async function loadPortalDeal(
  dbName: string,
  token: string
): Promise<PortalDeal | undefined> {
  const row = await queryOne<{
    id: string;
    client_name: string;
    product: string;
    amount: number;
    months: number;
    opened_at: string;
    paid_count: number;
    credit: number;
    stage: DealStage;
    manager_name: string | null;
    manager_phone: string | null;
    original_months: number | null;
    restructured_months: number | null;
    restructured_from: string | null;
  }>(
    dbName,
    `select d.id, c.name as client_name, d.product, d.amount, d.months,
            d.opened_at, d.paid_count, d.credit, d.stage,
            u.name as manager_name, u.phone as manager_phone,
            d.original_months, d.restructured_months, d.restructured_from
     from deals d
     join clients c on c.id = d.client_id
     left join users u on u.id = d.manager_id
     where d.portal_token = $1 and d.deleted_at is null`,
    [token]
  );

  if (!row) return undefined;

  const restructure = restructureOf({
    originalMonths: row.original_months,
    restructuredMonths: row.restructured_months,
    restructuredFrom: row.restructured_from,
  });
  const payments = await loadPortalPayments(dbName, [row.id]);

  return {
    id: row.id,
    clientFirstName: row.client_name.split(" ")[1] ?? row.client_name,
    payments: payments.get(row.id) ?? [],
    product: row.product,
    amount: row.amount,
    months: row.months,
    openedAt: row.opened_at,
    // у закрытой сделки выплачены все взносы — та же логика, что в paidCount
    paid: row.stage === "closed" ? row.months : row.paid_count,
    credit: row.stage === "closed" ? 0 : Number(row.credit),
    managerName: row.manager_name ?? "менеджер",
    managerPhone: row.manager_phone,
    ...(restructure
      ? {
          originalMonths: restructure.originalMonths,
          restructuredMonths: restructure.restructuredMonths,
          restructuredFrom: restructure.from,
        }
      : {}),
  };
}

export interface PortalClientDeal {
  id: string;
  payments: PortalPayment[];
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  paid: number;
  /** Внесено в счёт следующего взноса (lib/payments.ts). */
  credit: number;
  stage: DealStage;
  originalMonths?: number;
  restructuredMonths?: number;
  restructuredFrom?: string;
}

export interface PortalClient {
  clientFirstName: string;
  managerName: string;
  managerPhone: string | null;
  deals: PortalClientDeal[];
}

/**
 * Данные для страницы /pay/<token>, когда токен — клиентский (одна ссылка
 * на все сделки клиента, см. clients.portal_token). Активные и закрытые
 * сделки — чтобы клиент видел и текущий график, и историю; новые/на
 * проверке/отклонённые ему смотреть незачем, это внутренняя кухня.
 */
export async function loadPortalClient(
  dbName: string,
  token: string
): Promise<PortalClient | undefined> {
  const client = await queryOne<{ id: string; name: string }>(
    dbName,
    "select id, name from clients where portal_token = $1",
    [token]
  );
  if (!client) return undefined;

  const rows = await query<{
    id: string;
    product: string;
    amount: number;
    months: number;
    opened_at: string;
    paid_count: number;
    credit: number;
    stage: DealStage;
    manager_name: string | null;
    manager_phone: string | null;
    original_months: number | null;
    restructured_months: number | null;
    restructured_from: string | null;
  }>(
    dbName,
    `select d.id, d.product, d.amount, d.months, d.opened_at, d.paid_count, d.credit,
            d.stage, u.name as manager_name, u.phone as manager_phone,
            d.original_months, d.restructured_months, d.restructured_from
     from deals d
     left join users u on u.id = d.manager_id
     where d.client_id = $1 and d.deleted_at is null
       and d.stage in ('active', 'closed')
     order by d.created_at desc`,
    [client.id]
  );

  if (rows.length === 0) return undefined;

  const payments = await loadPortalPayments(dbName, rows.map((r) => r.id));

  return {
    clientFirstName: client.name.split(" ")[1] ?? client.name,
    managerName: rows[0].manager_name ?? "менеджер",
    managerPhone: rows[0].manager_phone,
    deals: rows.map((row) => {
      const restructure = restructureOf({
        originalMonths: row.original_months,
        restructuredMonths: row.restructured_months,
        restructuredFrom: row.restructured_from,
      });
      return {
        id: row.id,
        payments: payments.get(row.id) ?? [],
        product: row.product,
        amount: row.amount,
        months: row.months,
        openedAt: row.opened_at,
        paid: row.stage === "closed" ? row.months : row.paid_count,
        credit: row.stage === "closed" ? 0 : Number(row.credit),
        stage: row.stage,
        ...(restructure
          ? {
              originalMonths: restructure.originalMonths,
              restructuredMonths: restructure.restructuredMonths,
              restructuredFrom: restructure.from,
            }
          : {}),
      };
    }),
  };
}

// ── Квитанции ──────────────────────────────────────────────────────────

export type PaymentKind = "installment" | "partial" | "down" | "payoff";

/** Один реально поступивший и не отменённый платёж клиента — строка «Истории платежей» в кабинете. */
export interface PortalPayment {
  id: string;
  kind: PaymentKind;
  installment?: number;
  date: string;
  amount: number;
}

interface PaymentRow extends Record<string, unknown> {
  id: string;
  deal_id: string;
  amount: number;
  occurred_at: string;
  installment_number: number | null;
  method: "cash" | "card" | "transfer" | null;
  title: string;
}

// Платежи клиента в кассе: взносы графика, первоначальный взнос и
// досрочное погашение. Отменённые (у которых есть запись-отмена) и сами
// записи-отмены не показываем — клиенту они ни о чём не говорят.
const VALID_PAYMENTS_SQL = `
  select p.id, p.deal_id, p.amount, p.occurred_at, p.installment_number, p.method, p.title
  from cash_tx p
  where p.kind = 'payment' and p.amount > 0 and p.reverses_id is null
    and not exists (select 1 from cash_tx r where r.reverses_id = p.id)`;

function paymentKind(row: PaymentRow): PaymentKind | undefined {
  if (row.installment_number !== null) {
    return row.title.startsWith("Частичная оплата") ? "partial" : "installment";
  }
  if (row.title.startsWith("Первоначальный взнос")) return "down";
  if (row.title.startsWith("Досрочное погашение")) return "payoff";
  return undefined;
}

async function loadPortalPayments(
  dbName: string,
  dealIds: string[]
): Promise<Map<string, PortalPayment[]>> {
  const rows = await query<PaymentRow>(
    dbName,
    `${VALID_PAYMENTS_SQL} and p.deal_id = any($1) order by p.occurred_at, p.id`,
    [dealIds]
  );

  const byDeal = new Map<string, PortalPayment[]>();
  for (const row of rows) {
    const kind = paymentKind(row);
    if (!kind) continue;
    const list = byDeal.get(row.deal_id) ?? [];
    list.push({
      id: String(row.id),
      kind,
      ...(row.installment_number !== null ? { installment: row.installment_number } : {}),
      date: row.occurred_at,
      amount: row.amount,
    });
    byDeal.set(row.deal_id, list);
  }
  return byDeal;
}

export interface PortalReceipt {
  id: string;
  companyName: string;
  payerName: string;
  dealId: string;
  product: string;
  kind: PaymentKind;
  installment?: number;
  months: number;
  date: string;
  amount: number;
  method: "cash" | "card" | "transfer" | null;
  /** Остаток долга по графику после этого платежа. */
  remainingAfter: number;
  managerName: string;
}

/**
 * Квитанция для /pay/<token>/receipt/<id>. Токен — клиентский или
 * сделки, как у самого кабинета; платёж обязан принадлежать сделке этого
 * токена, иначе квитанции «нет» — перебором id чужую квитанцию не открыть.
 */
export async function loadPortalReceipt(
  dbName: string,
  token: string,
  paymentId: string,
  companyName: string
): Promise<PortalReceipt | undefined> {
  if (!/^\d{1,18}$/.test(paymentId)) return undefined;

  const row = await queryOne<PaymentRow & {
    client_name: string;
    product: string;
    deal_amount: number;
    months: number;
    opened_at: string;
    original_months: number | null;
    restructured_months: number | null;
    restructured_from: string | null;
    manager_name: string | null;
  }>(
    dbName,
    `select v.*, c.name as client_name, d.product, d.amount as deal_amount, d.months,
            d.opened_at, d.original_months, d.restructured_months, d.restructured_from,
            u.name as manager_name
     from (${VALID_PAYMENTS_SQL} and p.id = $2) v
     join deals d on d.id = v.deal_id
     join clients c on c.id = d.client_id
     left join users u on u.id = d.manager_id
     where d.deleted_at is null
       and (c.portal_token = $1 or d.portal_token = $1)`,
    [token, paymentId]
  );
  if (!row) return undefined;

  const kind = paymentKind(row);
  if (!kind) return undefined;

  const schedule = buildSchedule(
    row.deal_amount,
    row.months,
    row.months,
    row.opened_at,
    restructureOf({
      originalMonths: row.original_months,
      restructuredMonths: row.restructured_months,
      restructuredFrom: row.restructured_from,
    })
  );
  const remainingAfter =
    kind === "payoff"
      ? 0
      : kind === "down"
        ? row.deal_amount
        : (schedule[(row.installment_number ?? 1) - 1]?.remaining ?? 0);

  // Как в самом кабинете — без полного ФИО: «Пётр С.»
  const [last, first] = row.client_name.split(" ");
  const payerName = first ? `${first} ${last[0]}.` : row.client_name;

  return {
    id: String(row.id),
    companyName,
    payerName,
    dealId: row.deal_id,
    product: row.product,
    kind,
    ...(row.installment_number !== null ? { installment: row.installment_number } : {}),
    months: row.months,
    date: row.occurred_at,
    amount: row.amount,
    method: row.method,
    remainingAfter,
    managerName: row.manager_name ?? "менеджер",
  };
}

// ── Сотрудники ─────────────────────────────────────────────────────────

export interface NewEmployeeInput {
  name: string;
  email: string;
  phone: string;
  role: "admin" | "manager" | "accountant";
}

/**
 * Заводит сотрудника с временным паролем. Пароль возвращается ОДИН раз —
 * в базе лежит только хеш, показать его повторно неоткуда.
 */
export async function createEmployee(
  dbName: string,
  input: NewEmployeeInput
): Promise<{ id: number; password: string }> {
  const { generatePassword, hashPassword, initialsFrom } = await import("./auth");
  const password = generatePassword();

  const existing = await queryOne<{ id: number }>(
    dbName,
    "select id from users where email = $1",
    [input.email]
  );
  if (existing) throw new Error("EMAIL_TAKEN");

  const row = await queryOne<{ id: number }>(
    dbName,
    `insert into users (email, password_hash, name, initials, role, phone,
                        must_change_password)
     values ($1, $2, $3, $4, $5, $6, true)
     returning id`,
    [
      input.email,
      await hashPassword(password),
      input.name,
      initialsFrom(input.name),
      input.role,
      input.phone || null,
    ]
  );
  if (!row) throw new Error("Сотрудник не создан");

  return { id: row.id, password };
}

/** Отключает или включает доступ. Сделки сотрудника остаются за ним. */
export async function setEmployeeActive(
  dbName: string,
  userId: number,
  active: boolean
): Promise<void> {
  await transaction(dbName, async (client) => {
    // Нельзя отключить последнего администратора — иначе компания
    // останется без того, кто может заводить сотрудников
    if (!active) {
      const { rows } = await client.query<{ count: string }>(
        "select count(*) from users where role = 'admin' and active and id <> $1",
        [userId]
      );
      if (Number(rows[0].count) === 0) throw new Error("LAST_ADMIN");
    }
    await client.query("update users set active = $2 where id = $1", [userId, active]);
    if (!active) {
      await client.query("delete from sessions where user_id = $1", [userId]);
    }
  });
}

export interface UpdateEmployeeInput {
  name: string;
  phone: string;
  role: "admin" | "manager" | "accountant";
}

/** Правки карточки сотрудника: имя, телефон, роль. Почта — логин, её не меняем отсюда. */
export async function updateEmployee(
  dbName: string,
  userId: number,
  input: UpdateEmployeeInput
): Promise<Employee> {
  const { initialsFrom } = await import("./auth");

  return transaction(dbName, async (client) => {
    if (input.role !== "admin") {
      const { rows } = await client.query<{ role: string; count: string }>(
        `select
           (select role from users where id = $1) as role,
           (select count(*) from users where role = 'admin' and active and id <> $1) as count`,
        [userId]
      );
      if (rows[0]?.role === "admin" && Number(rows[0].count) === 0) {
        throw new Error("LAST_ADMIN");
      }
    }

    const { rows } = await client.query<{
      id: number; name: string; initials: string; email: string;
      phone: string | null; role: "admin" | "manager" | "accountant"; active: boolean; created_at: Date;
    }>(
      `update users set name = $2, initials = $3, phone = $4, role = $5
       where id = $1
       returning id, name, initials, email, phone, role, active, created_at`,
      [userId, input.name, initialsFrom(input.name), input.phone || null, input.role]
    );
    const row = rows[0];
    if (!row) throw new Error(`Сотрудник ${userId} не найден`);

    return {
      id: row.id,
      name: row.name,
      initials: row.initials,
      email: row.email,
      phone: row.phone ?? "—",
      role: row.role,
      since: sinceLabel(isoDate(row.created_at)),
      active: row.active,
    };
  });
}
