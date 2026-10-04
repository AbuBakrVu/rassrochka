import { handle, BadRequestError } from "@/app/api/_lib/handler";
import { setHiddenNavItems } from "@/lib/queries";
import { audit } from "@/lib/audit";

// Держать в паре с массивом nav в components/shell.tsx. "/settings" туда
// специально не входит — иначе владелец компании мог бы случайно скрыть
// сам пункт, которым включаются остальные, и остаться без доступа к нему.
const HIDEABLE = [
  "/",
  "/analytics",
  "/deals",
  "/clients",
  "/payments",
  "/collections",
  "/mailings",
  "/coinvestors",
  "/cash",
  "/registry",
  "/blacklist",
  "/employees",
  "/journal",
];

export async function PATCH(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const hidden = (body as { hidden?: unknown })?.hidden;
      if (!Array.isArray(hidden) || !hidden.every((h) => typeof h === "string")) {
        throw new BadRequestError("Поле «hidden» должно быть массивом строк");
      }
      const unknown = hidden.find((h) => !HIDEABLE.includes(h));
      if (unknown) {
        throw new BadRequestError(`Неизвестный пункт меню: «${unknown}»`);
      }

      await setHiddenNavItems(tenant.dbName, hidden);
      await audit(
        tenant.dbName, user.id, "settings.nav", null,
        hidden.length ? `Скрыты разделы меню: ${hidden.join(", ")}` : "Все разделы меню снова показаны"
      );
      return { ok: true };
    },
    { adminOnly: true }
  );
}
