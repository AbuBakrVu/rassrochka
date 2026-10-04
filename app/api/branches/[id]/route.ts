import { BadRequestError, handle, optionalStr, str } from "@/app/api/_lib/handler";
import { OrgError, updateBranch } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const branchId = Number(id);
      if (!Number.isInteger(branchId)) throw new BadRequestError("Неверный идентификатор");
      const name = str(body, "name", { max: 80 });
      const active = (body as { active?: unknown }).active !== false;
      try {
        await updateBranch(tenant.dbName, branchId, { name, address: optionalStr(body, "address"), active });
        await audit(
          tenant.dbName, user.id, "settings.branches", null,
          `Филиал «${name}» изменён${active ? "" : " · закрыт"}`
        );
        return { ok: true };
      } catch (err) {
        if (err instanceof OrgError) throw new BadRequestError(err.message);
        throw err;
      }
    },
    { adminOnly: true }
  );
}
