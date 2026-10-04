// Импорт клиентов и сделок из Excel. Тело: { rows: [{ line, values }], branchId? } —
// values уже сопоставлены с полями (lib/import.ts), проверка повторяется здесь.

import { BadRequestError, handle, optionalNum } from "@/app/api/_lib/handler";
import { runImport } from "@/lib/import-db";
import { MAX_IMPORT_ROWS } from "@/lib/import";
import { audit } from "@/lib/audit";
import { branchForWrite } from "@/lib/scope";
import { can } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/auth";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const rows = (body as { rows?: unknown }).rows;
      if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestError("Нет строк для импорта");
      if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestError(`Не больше ${MAX_IMPORT_ROWS} строк за раз`);
      const parsed = rows.map((r, i) => {
        const { line, values } = (r ?? {}) as { line?: unknown; values?: unknown };
        if (typeof values !== "object" || values === null || Array.isArray(values)) {
          throw new BadRequestError(`Строка ${i + 1}: нет значений`);
        }
        return { line: typeof line === "number" ? line : i + 2, values: values as Record<string, unknown> };
      });
      // Сделки из файла — только тому, кто вправе оформлять сделки
      const hasDeals = parsed.some((r) => String(r.values.product ?? "").trim() !== "");
      if (hasDeals && !can(user, "deals.edit")) throw new ForbiddenError("Нет права оформлять сделки — уберите колонку «Товар»");

      const fallbackBranchId = await branchForWrite(
        tenant.dbName, user, optionalNum(body, "branchId", { min: 1, integer: true })
      );
      const result = await runImport(tenant.dbName, {
        rows: parsed,
        userBranchId: user.branchId,
        fallbackBranchId,
      });
      await audit(
        tenant.dbName, user.id, "import.run", null,
        `Импорт из Excel: клиентов новых ${result.clientsCreated}, найдено ${result.clientsMatched}, ` +
          `сделок ${result.dealsCreated}, пропущено строк ${result.skipped.length}`
      );
      return result;
    },
    { perm: "clients.edit" }
  );
}
