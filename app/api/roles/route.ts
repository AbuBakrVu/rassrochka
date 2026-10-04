import { BadRequestError, handle, str, strArray } from "@/app/api/_lib/handler";
import { createRole, OrgError } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const name = str(body, "name", { max: 60 });
      try {
        const id = await createRole(tenant.dbName, {
          name,
          permissions: strArray(body, "permissions", { maxItems: 50, maxLen: 40 }),
        });
        await audit(tenant.dbName, user.id, "settings.roles", null, `Создана роль «${name}»`);
        return { id };
      } catch (err) {
        if (err instanceof OrgError) throw new BadRequestError(err.message);
        throw err;
      }
    },
    { adminOnly: true }
  );
}
