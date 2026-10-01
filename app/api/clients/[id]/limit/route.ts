import { handle, BadRequestError } from "@/app/api/_lib/handler";
import { setClientCreditLimit } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";

// Ручной лимит клиента. { limit: null } — вернуть автоматический расчёт.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const limit = (body as { limit?: unknown })?.limit;
      if (
        limit !== null &&
        (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0 || limit > 1e9)
      ) {
        throw new BadRequestError("Поле «limit» — сумма от 0 или null");
      }
      const value = limit === null ? null : Math.round(limit);
      await setClientCreditLimit(tenant.dbName, id, value);
      await audit(
        tenant.dbName, user.id, "client.limit", id,
        value === null
          ? `Клиенту ${id} возвращён автоматический лимит`
          : `Клиенту ${id} задан лимит ${rub(value)}`
      );
      return { ok: true };
    },
    { adminOnly: true }
  );
}
