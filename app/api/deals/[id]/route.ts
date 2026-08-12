import { BadRequestError, handle, num, optionalNum, optionalStr, str } from "@/app/api/_lib/handler";
import { deleteDeal, updateDeal } from "@/lib/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(request, async ({ tenant, body }) => {
    const raw = (body as { reminderTemplateId?: unknown } | null)?.reminderTemplateId;
    const reminderTemplateId = raw === undefined ? undefined : raw === null ? null : String(raw);

    try {
      return await updateDeal(tenant.dbName, id, {
        product: str(body, "product", { max: 200 }),
        nextStep: optionalStr(body, "nextStep", ""),
        managerId: num(body, "managerId", { min: 1, integer: true }),
        amount: optionalNum(body, "amount", { min: 1, max: 1e9 }),
        months: optionalNum(body, "months", { min: 1, max: 120, integer: true }),
        markupPct: optionalNum(body, "markupPct", { min: 0, max: 1000 }),
        reminderTemplateId,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_PAID") {
        throw new BadRequestError(
          "По сделке уже есть принятые платежи — сумму, срок и наценку менять нельзя"
        );
      }
      throw err;
    }
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant }) => {
      try {
        await deleteDeal(tenant.dbName, id);
      } catch (err) {
        if (err instanceof Error && err.message === "HAS_PAYMENTS") {
          throw new BadRequestError(
            "По сделке уже есть принятые платежи — удалить нельзя, только реструктурировать или закрыть"
          );
        }
        throw err;
      }
      return { ok: true };
    },
    { adminOnly: true }
  );
}
