import { BadRequestError, handle, isoDate, num, optionalStr } from "@/app/api/_lib/handler";
import { adjustCoinvestorCapital } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body }) => {
      const direction = (body as { direction?: unknown })?.direction;
      if (direction !== "deposit" && direction !== "withdrawal") {
        throw new BadRequestError("Поле «direction» должно быть deposit или withdrawal");
      }

      try {
        return await adjustCoinvestorCapital(tenant.dbName, id, {
          direction,
          amount: num(body, "amount", { min: 0.01, max: 1e9 }),
          date: isoDate(body, "date"),
          note: optionalStr(body, "note") || undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "NOT_ENOUGH_CAPITAL") {
          throw new BadRequestError("Нельзя снять больше, чем вложено");
        }
        throw err;
      }
    },
    { adminOnly: true }
  );
}
