import { BadRequestError, handle, isoDate, num, optionalStr, str, strArray } from "@/app/api/_lib/handler";
import { createDeal } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(request, ({ tenant, body }) => {
    const guarantorIds = strArray(body, "guarantorIds", { maxItems: 5, maxLen: 20 });
    if (guarantorIds.length !== new Set(guarantorIds).size) {
      throw new BadRequestError("Поручитель указан дважды");
    }

    return createDeal(tenant.dbName, {
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
    });
  });
}
