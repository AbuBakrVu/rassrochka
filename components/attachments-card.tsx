"use client";

import { useState } from "react";
import { FileText, ImagePlus, Trash2, Loader2, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { useData, type Attachment } from "@/lib/store";

// Файлы клиента (паспорт, документы) или сделки (фото товара): превью,
// открытие в новой вкладке, загрузка и удаление. Содержимое отдаёт
// /api/attachments/<id> — только администратору и менеджеру.

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const sizeLabel = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;

export default function AttachmentsCard({
  title,
  icon: Icon,
  clientId,
  dealId,
  kinds,
  hint,
}: {
  title: string;
  icon: LucideIcon;
  clientId?: string;
  dealId?: string;
  /** Типы файлов: первый — для загрузки по умолчанию; если их несколько, менеджер выбирает. */
  kinds: { kind: Attachment["kind"]; label: string }[];
  hint: string;
}) {
  const { attachments, uploadAttachment, deleteAttachment, user } = useData();
  const [kind, setKind] = useState(kinds[0].kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Бухгалтеру файлы не приходят и не открываются (паспортные данные)
  if (user.role === "accountant") return null;

  const files = attachments.filter(
    (a) => (clientId ? a.clientId === clientId : a.dealId === dealId) && kinds.some((k) => k.kind === a.kind)
  );
  const labelOf = (k: Attachment["kind"]) => kinds.find((x) => x.kind === k)?.label ?? "";

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await uploadAttachment({ clientId, dealId, kind, files: Array.from(list) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Attachment) => {
    if (!confirm(`Удалить «${a.name}»? Вернуть файл будет нельзя.`)) return;
    setError(null);
    try {
      await deleteAttachment(a.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Icon size={16} className="text-brand" aria-hidden />
        <h2 className="font-semibold">{title}</h2>
        {files.length > 0 && <span className="text-sm text-mute">· {files.length}</span>}
      </div>
      {files.length === 0 && <p className="mb-3 text-sm text-mute">{hint}</p>}

      {files.length > 0 && (
        <ul className="mt-3 mb-3 grid grid-cols-3 gap-2">
          {files.map((a) => (
            <li key={a.id} className="group relative">
              <a
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noopener"
                title={`${a.name} · ${sizeLabel(a.size)}`}
                className="block aspect-square overflow-hidden rounded-[14px] border border-line bg-canvas hover:border-brand"
              >
                {a.contentType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- файл из нашего API, оптимизатор Next не нужен
                  <img src={`/api/attachments/${a.id}`} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1 px-1 text-mute">
                    <FileText size={22} aria-hidden />
                    <span className="w-full truncate text-center text-[11px]">{a.name}</span>
                  </span>
                )}
              </a>
              {kinds.length > 1 && (
                <span className="pointer-events-none absolute bottom-1 left-1 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium">
                  {labelOf(a.kind)}
                </span>
              )}
              <button
                onClick={() => remove(a)}
                aria-label={`Удалить ${a.name}`}
                className="absolute top-1 right-1 rounded-lg bg-surface p-1 text-danger opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {kinds.length > 1 && (
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Attachment["kind"])}
            aria-label="Что загружаем"
            className="rounded-full border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-brand"
          >
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        )}
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-mute hover:border-brand hover:text-brand ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ImagePlus size={15} aria-hidden />}
          {busy ? "Загружаем…" : "Добавить файлы"}
          <input
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-mute">Фото или PDF, до 5 МБ. Большие фото уменьшаются сами.</p>
      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
