// Всё состояние компании одним запросом — замена чтения localStorage.

import { handle } from "@/app/api/_lib/handler";
import { loadBootstrap } from "@/lib/queries";

export async function GET(request: Request) {
  return handle(request, ({ tenant }) => loadBootstrap(tenant.dbName));
}
