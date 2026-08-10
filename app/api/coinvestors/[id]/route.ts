import { BadRequestError, handle, num, optionalStr, str } from "@/app/api/_lib/handler";
import { deleteCoinvestor, setCoinvestorActive, updateCoinvestor } from "@/lib/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body }) => {
      const active = (body as { active?: unknown })?.active;
      if (active !== undefined) {
        if (typeof active !== "boolean") {
          throw new BadRequestError("Поле «active» должно быть true или false");
        }
        await setCoinvestorActive(tenant.dbName, id, active);
        return { ok: true };
      }

      return updateCoinvestor(tenant.dbName, id, {
        name: str(body, "name", { max: 120 }),
        phone: optionalStr(body, "phone"),
        profitSharePct: num(body, "profitSharePct", { min: 0, max: 100 }),
      });
    },
    { adminOnly: true }
  );
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
        await deleteCoinvestor(tenant.dbName, id);
      } catch (err) {
        if (err instanceof Error && err.message === "HAS_HISTORY") {
          throw new BadRequestError(
            "У соинвестора есть капитал или неполученная прибыль — сначала снимите капитал и выплатите остаток"
          );
        }
        throw err;
      }
      return { ok: true };
    },
    { adminOnly: true }
  );
}
