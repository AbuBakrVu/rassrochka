import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { loadApplySettings, loadPortalShowLimit, saveApplySettings, savePortalShowLimit } from "@/lib/queries";
import { normalizeApplySettings } from "@/lib/apply";
import { audit } from "@/lib/audit";

// Настройки онлайн-заявки (/apply) и показа предодобренного лимита в кабинете
export async function GET(request: Request) {
  return handle(
    request,
    async ({ tenant }) => ({
      apply: await loadApplySettings(tenant.dbName),
      portalShowLimit: await loadPortalShowLimit(tenant.dbName),
    }),
    { adminOnly: true }
  );
}

export async function PATCH(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const b = (body ?? {}) as { apply?: unknown; portalShowLimit?: unknown };
      if (b.apply === undefined && b.portalShowLimit === undefined) throw new BadRequestError("Нечего сохранять");
      const parts: string[] = [];
      if (b.apply !== undefined) {
        const s = normalizeApplySettings(b.apply);
        await saveApplySettings(tenant.dbName, s);
        parts.push(
          s.enabled
            ? `онлайн-заявка включена: наценка ${s.markupPct}%, сроки ${s.terms.join(", ")} мес., взнос от ${s.minDownPct}%`
            : "онлайн-заявка выключена"
        );
      }
      if (typeof b.portalShowLimit === "boolean") {
        await savePortalShowLimit(tenant.dbName, b.portalShowLimit);
        parts.push(b.portalShowLimit ? "лимит в кабинете показывается" : "лимит в кабинете скрыт");
      }
      await audit(tenant.dbName, user.id, "settings.apply", null, parts.join("; "));
      return { ok: true };
    },
    { adminOnly: true }
  );
}
