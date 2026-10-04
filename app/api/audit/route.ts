// Журнал действий сотрудников — только для администратора компании.

import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { loadAudit } from "@/lib/audit";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GROUPS = new Set(["deal", "payment", "cash", "client", "employee", "coinvestor", "settings"]);

export async function GET(request: Request) {
  return handle(
    request,
    async ({ tenant }) => {
      const sp = new URL(request.url).searchParams;

      const userId = sp.get("userId") ? Number(sp.get("userId")) : undefined;
      if (userId !== undefined && !Number.isInteger(userId)) {
        throw new BadRequestError("Неверный сотрудник");
      }
      const group = sp.get("group") || undefined;
      if (group && !GROUPS.has(group)) throw new BadRequestError("Неизвестный тип действия");
      const from = sp.get("from") || undefined;
      const to = sp.get("to") || undefined;
      if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) {
        throw new BadRequestError("Даты должны быть вида ГГГГ-ММ-ДД");
      }
      const q = (sp.get("q") ?? "").trim().slice(0, 100) || undefined;

      return loadAudit(tenant.dbName, { userId, group, from, to, q });
    },
    { perm: "journal" }
  );
}
