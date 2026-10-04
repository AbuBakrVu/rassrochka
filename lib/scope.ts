import "server-only";

// Филиал сотрудника: с филиалом он видит и ведёт только его клиентов,
// сделки и кассу, без филиала (branchId = null) — все. Чтение режется в
// loadBootstrap, запись — здесь: роуты сделок и клиентов передают id в
// handle(), и чужой филиал получает 403 ещё до самой операции.

import { queryOne } from "./db";
import { ForbiddenError } from "./auth";
import { BadRequestError } from "./errors";

interface Scoped {
  branchId: number | null;
}

const FOREIGN = "Это данные другого филиала";

export async function assertDealInScope(dbName: string, user: Scoped, dealId: string): Promise<void> {
  if (user.branchId === null) return;
  const row = await queryOne<{ branch_id: number }>(dbName, "select branch_id from deals where id = $1", [dealId]);
  // Несуществующую сделку пропускаем — роут сам ответит «не найдена»
  if (row && row.branch_id !== user.branchId) throw new ForbiddenError(FOREIGN);
}

/**
 * Клиент «свой», если заведён в филиале сотрудника или у него есть сделка
 * в этом филиале (клиент, купивший в двух точках, виден обеим).
 */
export async function assertClientInScope(dbName: string, user: Scoped, clientId: string): Promise<void> {
  if (user.branchId === null) return;
  const row = await queryOne<{ ok: boolean; exists: boolean }>(
    dbName,
    `select exists (select 1 from clients where id = $1) as exists,
            exists (select 1 from clients where id = $1 and branch_id = $2)
              or exists (select 1 from deals where client_id = $1 and branch_id = $2 and deleted_at is null) as ok`,
    [clientId, user.branchId]
  );
  if (row?.exists && !row.ok) throw new ForbiddenError(FOREIGN);
}

/**
 * Филиал, в который пишет сотрудник: свой — всегда; без своего — выбранный
 * (должен существовать и работать); undefined — решит база (филиал клиента
 * для сделки, первый филиал для клиента).
 */
export async function branchForWrite(
  dbName: string,
  user: Scoped,
  requested: number | undefined
): Promise<number | undefined> {
  if (user.branchId !== null) return user.branchId;
  if (requested === undefined) return undefined;
  const row = await queryOne<{ id: number }>(dbName, "select id from branches where id = $1 and active", [requested]);
  if (!row) throw new BadRequestError("Филиал не найден или закрыт");
  return row.id;
}
