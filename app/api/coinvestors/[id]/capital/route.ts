import { BadRequestError, handle, isoDate, num, optionalStr } from "@/app/api/_lib/handler";
import { adjustCoinvestorCapital } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const direction = (body as { direction?: unknown })?.direction;
      if (direction !== "deposit" && direction !== "withdrawal") {
        throw new BadRequestError("Поле «direction» должно быть deposit или withdrawal");
      }

      try {
        const amount = num(body, "amount", { min: 0.01, max: 1e9 });
        const result = await adjustCoinvestorCapital(tenant.dbName, id, {
          direction,
          amount,
          date: isoDate(body, "date"),
          note: optionalStr(body, "note") || undefined,
        });
        await audit(
          tenant.dbName, user.id, "coinvestor.capital", id,
          `Соинвестор ${id}: ${direction === "deposit" ? "внесение" : "снятие"} капитала ${rub(amount)}`
        );
        return result;
      } catch (err) {
        if (err instanceof Error && err.message === "NOT_ENOUGH_CAPITAL") {
          throw new BadRequestError("Нельзя снять больше, чем вложено");
        }
        throw err;
      }
    },
    { perm: "coinvestors" }
  );
}
