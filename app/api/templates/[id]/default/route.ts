import { handle } from "@/app/api/_lib/handler";
import { setDefaultTemplate } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant }) => {
      await setDefaultTemplate(tenant.dbName, id);
      return { ok: true };
    },
    { adminOnly: true }
  );
}
