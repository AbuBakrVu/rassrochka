// Всё состояние компании одним запросом — замена чтения localStorage.

import { handle } from "@/app/api/_lib/handler";
import { loadBootstrap } from "@/lib/queries";

export async function GET(request: Request) {
  return handle(request, ({ tenant, user }) =>
    loadBootstrap(tenant.dbName, {
      id: user.id,
      name: user.name,
      initials: user.initials,
      email: user.email,
      role: user.role,
      ...(user.roleName ? { roleName: user.roleName } : {}),
      permissions: user.permissions,
      branchId: user.branchId,
    })
  );
}
