import { handle, isoDate, num, str } from "@/app/api/_lib/handler";
import { addCashAdjustment } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(request, ({ tenant, body }) =>
    addCashAdjustment(tenant.dbName, {
      amount: num(body, "amount", { min: -1e9, max: 1e9 }),
      title: str(body, "title", { max: 200 }),
      date: isoDate(body, "date"),
    })
  );
}
