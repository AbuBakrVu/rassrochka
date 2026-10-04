import { BadRequestError, handle, str } from "@/app/api/_lib/handler";
import { createSavedFilter, type SavedFilterPage } from "@/lib/saved-filters";

const PAGES = new Set<SavedFilterPage>(["clients", "cash", "deals"]);

export async function POST(request: Request) {
  return handle(request, async ({ tenant, body, user }) => {
    const page = str(body, "page", { max: 20 }) as SavedFilterPage;
    if (!PAGES.has(page)) throw new BadRequestError("Неизвестная страница");

    // Только плоский объект строк — это значения полей фильтра, не больше
    const raw = (body as { params?: unknown })?.params;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new BadRequestError("Поле «params» должно быть объектом");
    }
    const entries = Object.entries(raw);
    if (
      entries.length > 10 ||
      entries.some(([k, v]) => typeof v !== "string" || k.length > 30 || v.length > 200)
    ) {
      throw new BadRequestError("Некорректные параметры фильтра");
    }

    try {
      return await createSavedFilter(tenant.dbName, user.id, {
        page,
        name: str(body, "name", { max: 60 }),
        params: Object.fromEntries(entries) as Record<string, string>,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "TOO_MANY") {
        throw new BadRequestError("Не больше 20 сохранённых фильтров на страницу");
      }
      throw err;
    }
  });
}
