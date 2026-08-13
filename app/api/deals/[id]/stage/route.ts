import { BadRequestError, handle, str } from "@/app/api/_lib/handler";
import { setDealStage } from "@/lib/queries";

const STAGES = ["new", "check", "active"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body }) => {
      const stage = str(body, "stage", { max: 10 });
      if (!STAGES.includes(stage)) {
        throw new BadRequestError("Стадия должна быть new, check или active");
      }

      try {
        return await setDealStage(tenant.dbName, id, stage as "new" | "check" | "active");
      } catch (err) {
        if (err instanceof Error && err.message === "HAS_PAYMENTS") {
          throw new BadRequestError(
            "По сделке уже есть принятые платежи — увести её из «Активна» нельзя"
          );
        }
        throw err;
      }
    },
    { roles: ["admin", "manager"] }
  );
}
