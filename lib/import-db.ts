import "server-only";

// Запись импорта из Excel одной транзакцией: либо переносится всё, либо
// ничего (ошибка посреди файла не оставит половину клиентов).
//
// Строки проверяются здесь заново (lib/import.ts, checkRow) — предпросмотру
// в браузере не верим. Клиенты сводятся по телефону (последние 10 цифр) с
// уже заведёнными и между собой; сделки создаются выданными (или закрытыми,
// если оплачены полностью) с источником 'import': прошлые деньги прошли в
// старой системе, поэтому в кассу и соинвесторам ничего не проводится.

import { transaction } from "./db";
import { buildSchedule } from "./schedule";
import { allocatePayment } from "./payments";
import { checkRow, clientKey, MAX_IMPORT_ROWS, type ImportRow } from "./import";
import { todayIso } from "./status";

export interface ImportOutcome {
  clientsCreated: number;
  clientsMatched: number;
  dealsCreated: number;
  skipped: { line: number; errors: string[] }[];
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

export async function runImport(
  dbName: string,
  input: {
    rows: { line: number; values: Record<string, unknown> }[];
    /** Филиал сотрудника — тогда всё идёт в него, иначе по колонке «Филиал» или fallbackBranchId. */
    userBranchId: number | null;
    fallbackBranchId?: number;
  }
): Promise<ImportOutcome> {
  if (input.rows.length > MAX_IMPORT_ROWS) throw new Error(`Не больше ${MAX_IMPORT_ROWS} строк за раз`);
  const today = todayIso();
  const checked = input.rows.map((r) => checkRow(r.values, r.line, today));
  const skipped = checked.filter((c) => !c.row).map((c) => ({ line: c.line, errors: c.errors }));
  const rows = checked.flatMap((c) => (c.row ? [c.row] : []));

  return transaction(dbName, async (client) => {
    const { rows: existing } = await client.query<{ id: string; name: string; phone: string }>(
      "select id, name, phone from clients order by created_at"
    );
    const known = new Map<string, string>();
    for (const c of existing) {
      const key = clientKey(c);
      if (!known.has(key)) known.set(key, c.id);
    }

    const { rows: users } = await client.query<{ id: number; name: string; email: string }>(
      "select id, name, email from users where active"
    );
    const managerOf = (value?: string) => {
      if (!value) return null;
      const v = norm(value);
      return users.find((u) => norm(u.email) === v || norm(u.name) === v)?.id ?? null;
    };

    const { rows: branches } = await client.query<{ id: number; name: string }>(
      "select id, name from branches where active"
    );
    const branchOf = (row: ImportRow): number | null => {
      if (input.userBranchId !== null) return input.userBranchId;
      const byName = row.branch ? branches.find((b) => norm(b.name) === norm(row.branch!))?.id : undefined;
      return byName ?? input.fallbackBranchId ?? null;
    };

    let clientsCreated = 0;
    let clientsMatched = 0;
    let dealsCreated = 0;
    const matchedIds = new Set<string>();

    for (const row of rows) {
      const branchId = branchOf(row);
      const key = clientKey(row);
      let clientId = known.get(key);

      if (clientId) {
        if (!matchedIds.has(clientId) && existing.some((c) => c.id === clientId)) {
          matchedIds.add(clientId);
          clientsMatched++;
        }
      } else {
        const { rows: created } = await client.query<{ id: string }>(
          `insert into clients (name, phone, birth_date, passport_series, passport_number,
                                registration_address, inn, branch_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
          [
            row.name, row.phone, row.birthDate ?? null, row.passportSeries ?? null, row.passportNumber ?? null,
            row.address ?? null, row.inn || null, branchId,
          ]
        );
        clientId = created[0].id;
        known.set(key, clientId);
        clientsCreated++;
      }

      if (!row.deal) continue;
      const d = row.deal;
      const amounts = buildSchedule(d.amount, d.months, 0, d.openedAt).map((p) => p.amount);
      let paidCount = 0;
      let credit = 0;
      if (d.paid > 0) {
        const alloc = allocatePayment(amounts, 0, 0, d.paid);
        if (!alloc.ok) {
          skipped.push({ line: row.line, errors: ["оплачено больше суммы в рассрочку"] });
          continue;
        }
        paidCount = alloc.paid;
        credit = alloc.credit;
      }
      const stage = paidCount >= d.months ? "closed" : "active";

      const { rows: deal } = await client.query<{ id: string }>(
        `insert into deals (client_id, product, category, amount, months, markup_pct, opened_at,
                            manager_id, stage, paid_count, credit, down_payment, source, branch_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'import', $13)
         returning id`,
        [
          clientId, d.product, d.category ?? null, d.amount, d.months, d.markupPct, d.openedAt,
          managerOf(row.manager), stage, paidCount, credit, d.down || null, branchId,
        ]
      );
      await client.query("insert into deal_events (deal_id, text, occurred_at) values ($1, $2, $3)", [
        deal[0].id,
        `Перенесена из Excel · оплачено ${d.paid.toLocaleString("ru-RU")} ₽ из ${d.amount.toLocaleString("ru-RU")} ₽` +
          (d.down ? `, первый взнос ${d.down.toLocaleString("ru-RU")} ₽` : ""),
        d.openedAt,
      ]);
      dealsCreated++;
    }

    return { clientsCreated, clientsMatched, dealsCreated, skipped: skipped.sort((a, b) => a.line - b.line) };
  });
}
