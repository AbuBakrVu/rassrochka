import "server-only";

// Сохранённые фильтры страниц (таблица saved_filters) — личные, у каждого
// сотрудника свои.

import { query, queryOne } from "./db";

export type SavedFilterPage = "clients" | "cash" | "deals";

export interface SavedFilter {
  id: string;
  page: SavedFilterPage;
  name: string;
  params: Record<string, string>;
}

interface Row extends Record<string, unknown> {
  id: number;
  page: SavedFilterPage;
  name: string;
  params: Record<string, string>;
}

const toFilter = (r: Row): SavedFilter => ({
  id: String(r.id),
  page: r.page,
  name: r.name,
  params: r.params,
});

export async function listSavedFilters(dbName: string, userId: number): Promise<SavedFilter[]> {
  const rows = await query<Row>(
    dbName,
    "select id, page, name, params from saved_filters where user_id = $1 order by created_at",
    [userId]
  );
  return rows.map(toFilter);
}

export async function createSavedFilter(
  dbName: string,
  userId: number,
  input: { page: SavedFilterPage; name: string; params: Record<string, string> }
): Promise<SavedFilter> {
  const rows = await query<{ count: number }>(
    dbName,
    "select count(*)::int as count from saved_filters where user_id = $1 and page = $2",
    [userId, input.page]
  );
  if ((rows[0]?.count ?? 0) >= 20) throw new Error("TOO_MANY");

  const row = await queryOne<Row>(
    dbName,
    `insert into saved_filters (user_id, page, name, params) values ($1, $2, $3, $4::jsonb)
     returning id, page, name, params`,
    [userId, input.page, input.name, JSON.stringify(input.params)]
  );
  if (!row) throw new Error("Фильтр не сохранён");
  return toFilter(row);
}

/** Удаляет только свой фильтр — чужой id молча ничего не удалит. */
export async function deleteSavedFilter(dbName: string, userId: number, id: string): Promise<void> {
  await query(dbName, "delete from saved_filters where id = $1 and user_id = $2", [id, userId]);
}
