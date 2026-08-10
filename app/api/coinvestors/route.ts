import { handle, isoDate, optionalNum, optionalStr, num, str } from "@/app/api/_lib/handler";
import { createCoinvestor } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(
    request,
    ({ tenant, body }) =>
      createCoinvestor(tenant.dbName, {
        name: str(body, "name", { max: 120 }),
        phone: optionalStr(body, "phone"),
        profitSharePct: num(body, "profitSharePct", { min: 0, max: 100 }),
        startedAt: isoDate(body, "startedAt"),
        openingCapital: optionalNum(body, "openingCapital", { min: 0, max: 1e9 }),
      }),
    { adminOnly: true }
  );
}
