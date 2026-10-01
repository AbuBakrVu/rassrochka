import { handle, num } from "@/app/api/_lib/handler";
import { setClientDefaultLimit } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";

// Базовый лимит для клиентов без истории. 0 выключает автоматические лимиты.
export async function PATCH(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const limit = Math.round(num(body, "defaultLimit", { min: 0, max: 1e9 }));
      await setClientDefaultLimit(tenant.dbName, limit);
      await audit(
        tenant.dbName, user.id, "settings.credit", null,
        limit > 0
          ? `Базовый лимит клиента: ${rub(limit)}`
          : "Автоматический лимит клиентов выключен"
      );
      return { ok: true };
    },
    { adminOnly: true }
  );
}
