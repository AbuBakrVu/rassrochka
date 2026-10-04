// Перевыпуск ссылки на кабинет соинвестора: старая перестаёт открываться.

import { handle } from "@/app/api/_lib/handler";
import { regenerateCoinvestorToken } from "@/lib/queries";
import { audit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    request,
    async ({ tenant, user }) => {
      const portalToken = await regenerateCoinvestorToken(tenant.dbName, id);
      await audit(tenant.dbName, user.id, "coinvestor.update", id, `Перевыпущена ссылка на кабинет соинвестора ${id}`);
      return { portalToken };
    },
    { perm: "coinvestors" }
  );
}
