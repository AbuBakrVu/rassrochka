import { BadRequestError, handle, str } from "@/app/api/_lib/handler";
import { setDealStage } from "@/lib/queries";
import { stages } from "@/lib/data";
import { audit } from "@/lib/audit";

const stageTitle = (key: string) => stages.find((s) => s.key === key)?.title ?? key;

const STAGES = ["new", "check", "active"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const stage = str(body, "stage", { max: 10 });
      if (!STAGES.includes(stage)) {
        throw new BadRequestError("Стадия должна быть new, check или active");
      }

      try {
        const deal = await setDealStage(tenant.dbName, id, stage as "new" | "check" | "active");
        await audit(
          tenant.dbName, user.id, "deal.stage", id,
          `Сделка ${id} · ${deal.client} перенесена в этап «${stageTitle(stage)}»`
        );
        return deal;
      } catch (err) {
        if (err instanceof Error && err.message === "HAS_PAYMENTS") {
          throw new BadRequestError(
            "По сделке уже есть принятые платежи — увести её из «Активна» нельзя"
          );
        }
        throw err;
      }
    },
    { perm: "deals.edit", dealId: id }
  );
}
