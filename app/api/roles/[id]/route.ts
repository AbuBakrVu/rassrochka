import { BadRequestError, handle, str, strArray } from "@/app/api/_lib/handler";
import { deleteRole, OrgError, updateRole } from "@/lib/org";
import { audit } from "@/lib/audit";

function roleId(id: string): number {
  const n = Number(id);
  if (!Number.isInteger(n)) throw new BadRequestError("Неверный идентификатор");
  return n;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const name = str(body, "name", { max: 60 });
      const permissions = strArray(body, "permissions", { maxItems: 50, maxLen: 40 });
      try {
        await updateRole(tenant.dbName, roleId(id), { name, permissions });
        await audit(tenant.dbName, user.id, "settings.roles", null, `Изменены права роли «${name}»`);
        return { ok: true };
      } catch (err) {
        if (err instanceof OrgError) throw new BadRequestError(err.message);
        throw err;
      }
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
        const name = await deleteRole(tenant.dbName, roleId(id));
        await audit(tenant.dbName, user.id, "settings.roles", null, `Удалена роль «${name}»`);
        return { ok: true };
      } catch (err) {
        if (err instanceof OrgError) throw new BadRequestError(err.message);
        throw err;
      }
    },
    { adminOnly: true }
  );
}
