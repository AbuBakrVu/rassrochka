import { BadRequestError, handle, optionalStr, str } from "@/app/api/_lib/handler";
import { createEmployee } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body }) => {
      const role = str(body, "role", { max: 10 });
      if (role !== "admin" && role !== "manager") {
        throw new BadRequestError("Роль должна быть admin или manager");
      }

      const email = str(body, "email", { max: 200 });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new BadRequestError("Некорректная почта");
      }

      try {
        return await createEmployee(tenant.dbName, {
          name: str(body, "name", { max: 120 }),
          email,
          phone: optionalStr(body, "phone"),
          role,
        });
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
