import { handle, optionalStr, BadRequestError } from "@/app/api/_lib/handler";
import { setClientBlacklisted } from "@/lib/queries";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const blacklisted = (body as { blacklisted?: unknown })?.blacklisted;
      if (typeof blacklisted !== "boolean") {
        throw new BadRequestError("Поле «blacklisted» должно быть true или false");
      }
      const reason = optionalStr(body, "reason");
      await setClientBlacklisted(tenant.dbName, id, blacklisted, reason);
      await audit(
        tenant.dbName, user.id, "client.blacklist", id,
        blacklisted
          ? `Клиент ${id} добавлен в чёрный список${reason ? ` — ${reason}` : ""}`
          : `Клиент ${id} убран из чёрного списка`
      );
      return { ok: true };
    },
    { perm: "clients.edit", clientId: id }
  );
}
