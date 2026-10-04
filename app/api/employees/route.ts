import { BadRequestError, handle, optionalStr, str } from "@/app/api/_lib/handler";
import { createEmployee } from "@/lib/queries";
import { audit } from "@/lib/audit";

const ROLE_TITLE = { admin: "администратор", manager: "менеджер", accountant: "бухгалтер" } as const;

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const role = str(body, "role", { max: 10 });
      if (role !== "admin" && role !== "manager" && role !== "accountant") {
        throw new BadRequestError("Роль должна быть admin, manager или accountant");
      }

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
        });
        await audit(tenant.dbName, user.id, "employee.create", null, `Приглашён сотрудник ${name} (${email}), роль ${ROLE_TITLE[role]}`);
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
