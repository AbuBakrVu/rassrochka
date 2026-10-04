import { handle, BadRequestError } from "@/app/api/_lib/handler";
import { deleteLogo, loadBranding, LogoError, saveBrandColor, saveLogo } from "@/lib/branding";
import { normalizeHex } from "@/lib/brand-color";
import { audit } from "@/lib/audit";

// Настройки → Оформление. Тело — только то, что меняется:
//   { color: "#1d5fd6" }  или  { color: null }   — свой цвет / стандартный
//   { logo: "data:image/png;base64,…" }  или  { logo: null }  — загрузить / убрать
// «Вернуть по умолчанию» = { color: null, logo: null }.
export async function PATCH(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const input = (body ?? {}) as { color?: unknown; logo?: unknown };
      const changes: string[] = [];

      if ("color" in input) {
        let color: string | null = null;
        if (input.color !== null) {
          color = typeof input.color === "string" ? normalizeHex(input.color) : null;
          if (!color) throw new BadRequestError("Цвет — в виде #RRGGBB или null");
        }
        await saveBrandColor(tenant.dbName, color);
        changes.push(color ? `основной цвет ${color}` : "стандартный цвет");
      }

      if ("logo" in input) {
        if (input.logo === null) {
          await deleteLogo(tenant.dbName);
          changes.push("логотип убран");
        } else if (typeof input.logo === "string") {
          try {
            await saveLogo(tenant.dbName, input.logo);
          } catch (err) {
            if (err instanceof LogoError) throw new BadRequestError(err.message);
            throw err;
          }
          changes.push("загружен новый логотип");
        } else {
          throw new BadRequestError("Логотип — картинка data:… или null");
        }
      }

      if (changes.length) {
        await audit(tenant.dbName, user.id, "settings.branding", null, `Оформление: ${changes.join(", ")}`);
      }
      return loadBranding(tenant.dbName);
    },
    { adminOnly: true }
  );
}
