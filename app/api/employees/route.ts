import { BadRequestError, handle, optionalStr, str } from "@/app/api/_lib/handler";
import { createEmployee } from "@/lib/queries";
import { audit } from "@/lib/audit";
import { branchName } from "@/lib/org";
import { roleInput } from "./role-input";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const { role, roleId, branchId, title } = await roleInput(tenant.dbName, body);

      const email = str(body, "email", { max: 200 });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new BadRequestError("Некорректная почта");
      }

      try {
        const name = str(body, "name", { max: 120 });
        const created = await createEmployee(tenant.dbName, {
          name,
          email,
          phone: optionalStr(body, "phone"),
          role,
          roleId,
          branchId,
        });
        await audit(
          tenant.dbName, user.id, "employee.create", null,
          `Приглашён сотрудник ${name} (${email}), роль ${title}, ${await branchName(tenant.dbName, branchId)}`
        );
        return created;
      } catch (err) {
        if (err instanceof Error && err.message === "EMAIL_TAKEN") {
          throw new BadRequestError("Сотрудник с такой почтой уже есть");
        }
        throw err;
      }
    },
    { adminOnly: true }
  );
}
