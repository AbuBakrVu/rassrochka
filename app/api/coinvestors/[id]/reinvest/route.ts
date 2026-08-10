import { handle, isoDate, num } from "@/app/api/_lib/handler";
import { reinvestCoinvestorProfit } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    ({ tenant, body }) =>
      reinvestCoinvestorProfit(tenant.dbName, id, {
        amount: num(body, "amount", { min: 0.01, max: 1e9 }),
        date: isoDate(body, "date"),
      }),
    { adminOnly: true }
  );
}
