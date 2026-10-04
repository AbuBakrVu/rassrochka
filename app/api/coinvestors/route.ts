import { handle, isoDate, optionalNum, optionalStr, str } from "@/app/api/_lib/handler";
import { createCoinvestor } from "@/lib/queries";
import { audit } from "@/lib/audit";
import { accrualInput } from "./accrual";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const investor = await createCoinvestor(tenant.dbName, {
        name: str(body, "name", { max: 120 }),
        phone: optionalStr(body, "phone"),
        ...accrualInput(body),
        startedAt: isoDate(body, "startedAt"),
        openingCapital: optionalNum(body, "openingCapital", { min: 0, max: 1e9 }),
      });
      await audit(tenant.dbName, user.id, "coinvestor.create", investor.id, `Добавлен соинвестор ${investor.id} · ${investor.name}`);
      return investor;
    },
    { perm: "coinvestors" }
  );
}
