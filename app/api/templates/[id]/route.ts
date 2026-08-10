import { handle, str } from "@/app/api/_lib/handler";
import { deleteTemplate, updateTemplate } from "@/lib/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    ({ tenant, body }) =>
      updateTemplate(tenant.dbName, id, {
        name: str(body, "name", { max: 120 }),
        body: str(body, "body", { max: 2000 }),
      }),
    { adminOnly: true }
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant }) => {
      await deleteTemplate(tenant.dbName, id);
      return { ok: true };
    },
    { adminOnly: true }
  );
}
