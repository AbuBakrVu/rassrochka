import { handle, isoDate, num } from "@/app/api/_lib/handler";
import { recordCoinvestorPayout } from "@/lib/queries";
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
      const result = await recordCoinvestorPayout(tenant.dbName, id, input);
      await audit(tenant.dbName, user.id, "coinvestor.payout", id, `Выплата соинвестору ${id}: ${rub(input.amount)}, дата ${input.date}`);
      return result;
    },
    { perm: "coinvestors" }
  );
}
