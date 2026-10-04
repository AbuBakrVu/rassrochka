import { BadRequestError, handle, optionalStr, str } from "@/app/api/_lib/handler";
import { AttachmentError, saveAttachment, type AttachmentKind } from "@/lib/attachments";
import { audit } from "@/lib/audit";
import { assertClientInScope, assertDealInScope } from "@/lib/scope";

const KINDS = new Set<AttachmentKind>(["passport", "document", "product", "other"]);

// Загрузить файл к клиенту (паспорт, документы) или к сделке (фото товара)
export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const clientId = optionalStr(body, "clientId") || undefined;
      const dealId = optionalStr(body, "dealId") || undefined;
      if (!clientId && !dealId) throw new BadRequestError("Укажите клиента или сделку");
      if (clientId) await assertClientInScope(tenant.dbName, user, clientId);
      if (dealId) await assertDealInScope(tenant.dbName, user, dealId);
      const kind = str(body, "kind", { max: 20 }) as AttachmentKind;
      if (!KINDS.has(kind)) throw new BadRequestError("Неизвестный тип файла");
      const dataUrl = (body as { dataUrl?: unknown }).dataUrl;
      if (typeof dataUrl !== "string") throw new BadRequestError("Нет файла");
      try {
        const file = await saveAttachment(tenant.dbName, {
          clientId,
          dealId,
          kind,
          name: str(body, "name", { max: 200 }),
          dataUrl,
          userId: user.id,
        });
        await audit(
          tenant.dbName, user.id, "client.document", clientId ?? dealId ?? null,
          `Загружен файл «${file.name}» · ${clientId ? `клиент ${clientId}` : `сделка ${dealId}`}`
        );
        return file;
      } catch (err) {
        if (err instanceof AttachmentError) throw new BadRequestError(err.message);
        // Клиента или сделки с таким номером нет (внешний ключ)
        if ((err as { code?: string }).code === "23503") throw new BadRequestError("Клиент или сделка не найдены");
        throw err;
      }
    },
    { perm: "clients.edit" }
  );
}
