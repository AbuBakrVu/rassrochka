import { BadRequestError, handle, num } from "@/app/api/_lib/handler";
import { reassignDeal } from "@/lib/queries";
import { audit, employeeName } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      try {
        const managerId = num(body, "managerId", { min: 1, integer: true });
        const deal = await reassignDeal(tenant.dbName, id, managerId);
        await audit(
          tenant.dbName, user.id, "deal.manager", id,
          `Сделка ${id} · ${deal.client}: ответственный — ${await employeeName(tenant.dbName, managerId)}`
        );
        return deal;
      } catch (err) {
        if (err instanceof Error && err.message === "MANAGER_NOT_FOUND") {
          throw new BadRequestError("Такой сотрудник не найден или отключён");
        }
        throw err;
      }
    },
    { perm: "deals.edit", dealId: id }
  );
}
