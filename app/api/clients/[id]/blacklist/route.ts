import { handle, optionalStr, BadRequestError } from "@/app/api/_lib/handler";
import { setClientBlacklisted } from "@/lib/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body }) => {
      const blacklisted = (body as { blacklisted?: unknown })?.blacklisted;
      if (typeof blacklisted !== "boolean") {
        throw new BadRequestError("Поле «blacklisted» должно быть true или false");
      }
      await setClientBlacklisted(
        tenant.dbName,
        id,
        blacklisted,
        optionalStr(body, "reason")
      );
      return { ok: true };
    },
    { roles: ["admin", "manager"] }
  );
}
