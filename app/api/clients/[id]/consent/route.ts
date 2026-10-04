import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { setClientConsent } from "@/lib/queries";
import { audit } from "@/lib/audit";

// Отметить или снять согласие клиента на обработку персональных данных
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const given = (body as { given?: unknown })?.given;
      if (typeof given !== "boolean") throw new BadRequestError("Поле «given» — true или false");
      await setClientConsent(tenant.dbName, id, given, "paper");
      await audit(
        tenant.dbName, user.id, "client.consent", id,
        given ? `Клиент ${id}: отмечено согласие на обработку ПДн` : `Клиент ${id}: отметка о согласии снята`
      );
      return { ok: true };
    },
    { perm: "clients.edit", clientId: id }
  );
}
