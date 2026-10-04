import { BadRequestError, handle, num, str } from "@/app/api/_lib/handler";
import { holidayDeal } from "@/lib/queries";
import { audit } from "@/lib/audit";

// Отсрочка платежа: неоплаченные взносы сдвигаются на N месяцев вперёд
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const months = num(body, "months", { min: 1, max: 6, integer: true });
      const reason = str(body, "reason", { max: 200 });
      try {
        const { deal, from, to } = await holidayDeal(tenant.dbName, id, { months, reason });
        await audit(
          tenant.dbName, user.id, "deal.holiday", id,
          `Сделка ${id} · ${deal.client}: отсрочка на ${months} мес., взнос с ${from} перенесён на ${to} — ${reason}`
        );
        return deal;
      } catch (err) {
        if (err instanceof Error && err.message === "NOT_ACTIVE") {
          throw new BadRequestError("Отсрочка возможна только по активной сделке");
        }
        if (err instanceof Error && err.message === "NOTHING_LEFT") {
          throw new BadRequestError("По сделке не осталось неоплаченных взносов");
        }
        throw err;
      }
    },
    { perm: "deals.edit", dealId: id }
  );
}
