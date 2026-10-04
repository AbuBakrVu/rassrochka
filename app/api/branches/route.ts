import { BadRequestError, handle, optionalStr, str } from "@/app/api/_lib/handler";
import { createBranch, OrgError } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const name = str(body, "name", { max: 80 });
      try {
        const id = await createBranch(tenant.dbName, { name, address: optionalStr(body, "address") });
        await audit(tenant.dbName, user.id, "settings.branches", null, `Открыт филиал «${name}»`);
        return { id };
      } catch (err) {
        if (err instanceof OrgError) throw new BadRequestError(err.message);
        throw err;
      }
    },
    { adminOnly: true }
  );
}
