import { handle, str, optionalStr } from "@/app/api/_lib/handler";
import { createClient } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(request, ({ tenant, body }) =>
    createClient(tenant.dbName, {
      lastName: str(body, "lastName", { max: 100 }),
      firstName: str(body, "firstName", { max: 100 }),
      phone: optionalStr(body, "phone"),
    })
  );
}
