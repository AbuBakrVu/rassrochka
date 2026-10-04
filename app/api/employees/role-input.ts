import { BadRequestError, str } from "@/app/api/_lib/handler";
import { queryOne } from "@/lib/db";
import { ROLE_LABEL, type RoleKind } from "@/lib/permissions";

// Роль и филиал сотрудника из тела запроса — общее для приглашения и правки.
// Файл без route-экспортов: Next не делает из него роут.

export async function roleInput(dbName: string, body: unknown): Promise<{
  role: RoleKind;
  roleId: number | null;
  branchId: number | null;
  title: string;
}> {
  const role = str(body, "role", { max: 10 });
  if (role !== "admin" && role !== "manager" && role !== "accountant" && role !== "custom") {
    throw new BadRequestError("Роль должна быть admin, manager, accountant или custom");
  }
  const b = body as { roleId?: unknown; branchId?: unknown };

  let roleId: number | null = null;
  let title: string = role === "custom" ? "" : ROLE_LABEL[role].toLowerCase();
  if (role === "custom") {
    if (typeof b.roleId !== "number") throw new BadRequestError("Выберите роль");
    const row = await queryOne<{ id: number; name: string }>(dbName, "select id, name from roles where id = $1", [b.roleId]);
    if (!row) throw new BadRequestError("Роль не найдена");
    roleId = row.id;
    title = `«${row.name}»`;
  }

  let branchId: number | null = null;
  if (role !== "admin" && b.branchId !== null && b.branchId !== undefined) {
    if (typeof b.branchId !== "number") throw new BadRequestError("Неверный филиал");
    const row = await queryOne<{ id: number }>(dbName, "select id from branches where id = $1", [b.branchId]);
    if (!row) throw new BadRequestError("Филиал не найден");
    branchId = row.id;
  }

  return { role, roleId, branchId, title };
}
