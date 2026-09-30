import { BadRequestError, handle, num, optionalStr, str } from "@/app/api/_lib/handler";
import { deleteCoinvestor, setCoinvestorActive, updateCoinvestor } from "@/lib/queries";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const active = (body as { active?: unknown })?.active;
      if (active !== undefined) {
        if (typeof active !== "boolean") {
          throw new BadRequestError("Поле «active» должно быть true или false");
        }
        await setCoinvestorActive(tenant.dbName, id, active);
        await audit(tenant.dbName, user.id, "coinvestor.update", id, `Соинвестор ${id} ${active ? "включён" : "отключён"}`);
        return { ok: true };
      }

      const input = {
        name: str(body, "name", { max: 120 }),
        phone: optionalStr(body, "phone"),
        profitSharePct: num(body, "profitSharePct", { min: 0, max: 100 }),
      };
      const updated = await updateCoinvestor(tenant.dbName, id, input);
      await audit(
        tenant.dbName, user.id, "coinvestor.update", id,
        `Изменены данные соинвестора ${id} · ${input.name}, доля ${input.profitSharePct}%`
      );
      return updated;
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
    async ({ tenant, user }) => {
      try {
        await deleteCoinvestor(tenant.dbName, id);
        await audit(tenant.dbName, user.id, "coinvestor.delete", null, `Удалён соинвестор ${id}`);
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
