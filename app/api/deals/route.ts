import { handle, isoDate, num, str } from "@/app/api/_lib/handler";
import { createDeal } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(request, ({ tenant, body }) =>
    createDeal(tenant.dbName, {
      product: str(body, "product", { max: 200 }),
      amount: num(body, "amount", { min: 1, max: 1e9 }),
      months: num(body, "months", { min: 1, max: 120, integer: true }),
      markupPct: num(body, "markupPct", { min: 0, max: 1000 }),
      openedAt: isoDate(body, "openedAt"),
      clientId: str(body, "clientId", { max: 20 }),
      managerInitials: str(body, "manager", { max: 8 }),
    })
  );
}
