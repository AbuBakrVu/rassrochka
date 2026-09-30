import { handle, isoDate, num } from "@/app/api/_lib/handler";
import { reinvestCoinvestorProfit } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const input = {
        amount: num(body, "amount", { min: 0.01, max: 1e9 }),
        date: isoDate(body, "date"),
      };
      const result = await reinvestCoinvestorProfit(tenant.dbName, id, input);
      await audit(tenant.dbName, user.id, "coinvestor.reinvest", id, `Реинвестирована прибыль соинвестора ${id}: ${rub(input.amount)}`);
      return result;
    },
    { adminOnly: true }
  );
}
