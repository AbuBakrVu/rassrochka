import "server-only";

// Журнал действий сотрудников (таблица audit_log). Пишется из API-роутов
// ПОСЛЕ успешной операции — там известны и автор, и результат. Сбой записи
// в журнал не должен ронять уже выполненную операцию: ошибку только логируем.

import { query } from "./db";

/** Коды действий. Группа до точки — для фильтра на странице журнала. */
export type AuditAction =
  | "deal.create"
  | "deal.update"
  | "deal.delete"
  | "deal.stage"
  | "deal.manager"
  | "deal.close"
  | "deal.restructure"
  | "payment.accept"
  | "payment.undo"
  | "cash.adjustment"
  | "client.create"
  | "client.blacklist"
  | "employee.create"
  | "employee.update"
  | "coinvestor.create"
  | "coinvestor.update"
  | "coinvestor.delete"
  | "coinvestor.payout"
  | "coinvestor.reinvest"
  | "coinvestor.capital"
  | "settings.nav";

export async function audit(
  dbName: string,
  userId: number,
  action: AuditAction,
  entityId: string | null,
  details: string
): Promise<void> {
  try {
    await query(
      dbName,
      `insert into audit_log (user_id, action, entity_id, details) values ($1, $2, $3, $4)`,
      [userId, action, entityId, details]
    );
  } catch (err) {
    console.error("[audit]", err instanceof Error ? err.message : err);
  }
}

export interface AuditEntry {
  id: string;
  at: string; // ISO с временем
  userId: number | null;
  userName: string;
  action: string;
  entityId: string | null;
  details: string;
}

export interface AuditFilter {
  userId?: number;
  group?: string;
  from?: string;
  to?: string;
  q?: string;
}

/** Последние записи журнала по фильтру (не больше limit). */
export async function loadAudit(
  dbName: string,
  filter: AuditFilter,
  limit = 500
): Promise<AuditEntry[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  /** Кладёт значение в параметры и возвращает его плейсхолдер ($N). */
  const p = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filter.userId) where.push(`a.user_id = ${p(filter.userId)}`);
  if (filter.group) where.push(`a.action like ${p(`${filter.group}.%`)}`);
  // Даты — в часовом поясе Москвы: так их видит владелец компании
  if (filter.from) {
    where.push(`(a.occurred_at at time zone 'Europe/Moscow')::date >= ${p(filter.from)}::date`);
  }
  if (filter.to) {
    where.push(`(a.occurred_at at time zone 'Europe/Moscow')::date <= ${p(filter.to)}::date`);
  }
  if (filter.q) {
    const q = p(`%${filter.q}%`);
    where.push(`(a.details ilike ${q} or a.entity_id ilike ${q})`);
  }
  const whereSql = where.join(" and ");

  const rows = await query<{
    id: number;
    occurred_at: Date;
    user_id: number | null;
    user_name: string | null;
    action: string;
    entity_id: string | null;
    details: string;
  }>(
    dbName,
    `select a.id, a.occurred_at, a.user_id, u.name as user_name, a.action, a.entity_id, a.details
     from audit_log a left join users u on u.id = a.user_id
     ${whereSql ? `where ${whereSql}` : ""}
     order by a.occurred_at desc, a.id desc
     limit ${p(limit)}`,
    params
  );

  return rows.map((r) => ({
    id: String(r.id),
    at: r.occurred_at.toISOString(),
    userId: r.user_id,
    userName: r.user_name ?? "Удалённый сотрудник",
    action: r.action,
    entityId: r.entity_id,
    details: r.details,
  }));
}

/** Имя сотрудника для текста записи журнала. */
export async function employeeName(dbName: string, id: number): Promise<string> {
  const rows = await query<{ name: string }>(dbName, "select name from users where id = $1", [id]);
  return rows[0]?.name ?? `сотрудник #${id}`;
}

export const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
