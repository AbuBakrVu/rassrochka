import { BadRequestError, handle, isoDate, num, optionalNum, optionalStr, str, strArray } from "@/app/api/_lib/handler";
import { createDeal } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const guarantorIds = strArray(body, "guarantorIds", { maxItems: 5, maxLen: 20 });
      if (guarantorIds.length !== new Set(guarantorIds).size) {
        throw new BadRequestError("Поручитель указан дважды");
      }

      const deal = await createDeal(tenant.dbName, {
        product: str(body, "product", { max: 200 }),
        amount: num(body, "amount", { min: 1, max: 1e9 }),
        months: num(body, "months", { min: 1, max: 120, integer: true }),
        markupPct: num(body, "markupPct", { min: 0, max: 1000 }),
        openedAt: isoDate(body, "openedAt"),
        clientId: str(body, "clientId", { max: 20 }),
        managerId: num(body, "managerId", { min: 1, integer: true }),
        description: optionalStr(body, "description", ""),
        category: optionalStr(body, "category", ""),
        city: optionalStr(body, "city", ""),
        guarantorIds,
        downPayment: optionalNum(body, "downPayment", { min: 0, max: 1e9 }),
      });
      // Лимит клиента считается в браузере (lib/credit.ts) и только
      // предупреждает — флаг нужен, чтобы владелец видел такие сделки в журнале
      const overLimit = (body as { overLimit?: unknown })?.overLimit === true;
      await audit(
        tenant.dbName, user.id, "deal.create", deal.id,
        `Создана сделка ${deal.id} · ${deal.client} · ${deal.product} на ${rub(deal.amount)}, ${deal.months} мес.` +
          (overLimit ? " · сверх лимита клиента" : "")
      );
      return deal;
    },
    { roles: ["admin", "manager"] }
  );
}
