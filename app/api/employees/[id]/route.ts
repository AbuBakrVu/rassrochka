import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { setEmployeeActive } from "@/lib/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const userId = Number(id);
      if (!Number.isInteger(userId)) throw new BadRequestError("Неверный идентификатор");

      const active = (body as { active?: unknown })?.active;
      if (typeof active !== "boolean") {
        throw new BadRequestError("Поле «active» должно быть true или false");
      }
      if (userId === user.id && !active) {
        throw new BadRequestError("Нельзя отключить самого себя");
      }

      try {
        await setEmployeeActive(tenant.dbName, userId, active);
      } catch (err) {
        if (err instanceof Error && err.message === "LAST_ADMIN") {
          throw new BadRequestError("Это последний администратор компании");
        }
        throw err;
      }
      return { ok: true };
    },
    { adminOnly: true }
  );
}
