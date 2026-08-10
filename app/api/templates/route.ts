import { handle, str } from "@/app/api/_lib/handler";
import { createTemplate } from "@/lib/queries";

export async function POST(request: Request) {
  return handle(
    request,
    ({ tenant, body }) =>
      createTemplate(tenant.dbName, {
        name: str(body, "name", { max: 120 }),
        body: str(body, "body", { max: 2000 }),
      }),
    { adminOnly: true }
  );
}
