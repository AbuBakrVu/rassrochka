import { BadRequestError, handle, str } from "@/app/api/_lib/handler";
import { rejectDeal } from "@/lib/queries";
import { audit } from "@/lib/audit";

// Отказ по заявке с причиной — она попадает в Аналитику («Причины отказов»)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const reason = str(body, "reason", { max: 200 });
      try {
        const deal = await rejectDeal(tenant.dbName, id, reason);
        await audit(tenant.dbName, user.id, "deal.reject", id, `Заявка ${id} · ${deal.client} отклонена: ${reason}`);
        return deal;
      } catch (err) {
        if (err instanceof Error && err.message === "HAS_PAYMENTS") {
          throw new BadRequestError("По сделке уже есть платежи — отклонить нельзя, её можно только закрыть");
        }
        throw err;
      }
    },
    { perm: "deals.edit", dealId: id }
  );
}
