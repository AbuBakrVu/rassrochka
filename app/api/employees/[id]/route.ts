import { BadRequestError, handle, optionalStr, str } from "@/app/api/_lib/handler";
import { setEmployeeActive, updateEmployee } from "@/lib/queries";
import { audit, employeeName } from "@/lib/audit";
import { branchName } from "@/lib/org";
import { roleInput } from "../role-input";

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
      if (active !== undefined) {
        if (typeof active !== "boolean") {
          throw new BadRequestError("Поле «active» должно быть true или false");
        }
        if (userId === user.id && !active) {
          throw new BadRequestError("Нельзя отключить самого себя");
        }

        try {
          await setEmployeeActive(tenant.dbName, userId, active);
          await audit(
            tenant.dbName, user.id, "employee.update", null,
            `Сотрудник ${await employeeName(tenant.dbName, userId)} ${active ? "включён" : "отключён"}`
          );
        } catch (err) {
          if (err instanceof Error && err.message === "LAST_ADMIN") {
            throw new BadRequestError("Это последний администратор компании");
          }
          throw err;
        }
        return { ok: true };
      }

      const { role, roleId, branchId, title } = await roleInput(tenant.dbName, body);
      if (userId === user.id && role !== "admin") {
        throw new BadRequestError("Нельзя понизить самого себя — попросите другого администратора");
      }

      try {
        const name = str(body, "name", { max: 120 });
        const updated = await updateEmployee(tenant.dbName, userId, {
          name,
          phone: optionalStr(body, "phone"),
          role,
          roleId,
          branchId,
        });
        await audit(
          tenant.dbName, user.id, "employee.update", null,
          `Изменены данные сотрудника ${name}, роль ${title}, ${await branchName(tenant.dbName, branchId)}`
        );
        return updated;
      } catch (err) {
        if (err instanceof Error && err.message === "LAST_ADMIN") {
          throw new BadRequestError("Это последний администратор компании");
        }
        throw err;
      }
    },
    { adminOnly: true }
  );
}
