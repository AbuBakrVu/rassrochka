import { handle, isoDate, num, optionalStr, str } from "@/app/api/_lib/handler";
import { createCoinvestor } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(
    request,
    ({ tenant, body }) =>
      createCoinvestor(tenant.dbName, {
        name: str(body, "name", { max: 120 }),
        phone: optionalStr(body, "phone"),
        investedAmount: num(body, "investedAmount", { min: 0, max: 1e9 }),
        monthlyPercent: num(body, "monthlyPercent", { min: 0, max: 100 }),
        startedAt: isoDate(body, "startedAt"),
      }),
    { adminOnly: true }
  );
}
