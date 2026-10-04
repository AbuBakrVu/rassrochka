import { BadRequestError, handle, isoDate, num, optionalStr, str } from "@/app/api/_lib/handler";
import { restructureDeal } from "@/lib/queries";
import { audit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      try {
        const input = {
          months: num(body, "months", { min: 1, max: 60, integer: true }),
          from: isoDate(body, "from"),
          reason: str(body, "reason", { max: 200 }),
          comment: optionalStr(body, "comment", ""),
        };
        const deal = await restructureDeal(tenant.dbName, id, input);
        await audit(
          tenant.dbName, user.id, "deal.restructure", id,
          `Сделка ${id} · ${deal.client}: график изменён на ${input.months} мес. с ${input.from} — ${input.reason}`
        );
        return deal;
      } catch (err) {
        if (err instanceof Error && err.message === "NOTHING_LEFT") {
          throw new BadRequestError("По сделке не осталось долга — менять график нечего");
        }
        if (err instanceof Error && err.message === "NOT_ACTIVE") {
          throw new BadRequestError("Реструктурировать можно только активную сделку");
        }
        throw err;
      }
    },
    { perm: "deals.edit", dealId: id }
  );
}
