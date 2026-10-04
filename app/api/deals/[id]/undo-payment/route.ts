import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { undoLastPayment } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, user }) => {
      try {
        const result = await undoLastPayment(tenant.dbName, id);
        await audit(
          tenant.dbName, user.id, "payment.undo", id,
          `Отменён платёж ${rub(result.amount)} по сделке ${id} · ${result.deal.client} — взнос ${result.installment}`
        );
        return result.deal;
      } catch (err) {
        if (err instanceof Error && err.message === "NOTHING_TO_UNDO") {
          throw new BadRequestError("По этой сделке ещё нет принятых платежей");
        }
        if (err instanceof Error && err.message === "NO_PAYMENT_RECORD") {
          throw new BadRequestError(
            "Этот взнос закрыт не отдельным платежом (например, досрочным погашением) — отменить его нельзя"
          );
        }
        throw err;
      }
    },
    { adminOnly: true }
  );
}
