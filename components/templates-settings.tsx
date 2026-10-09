"use client";

// Настройки → Шаблоны сообщений: тексты WhatsApp-напоминаний и их стадии в
// лесенке. Сама очередь отправки — components/reminder-queue.tsx.

import { useState } from "react";
import { Send, Star, Pencil, Trash2 } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { useData, type MessageTemplate } from "@/lib/store";
import { REMINDER_STAGE_LABEL, type ReminderStage } from "@/lib/data";

const field =
  "w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

const PLACEHOLDERS = ["{имя}", "{сумма}", "{товар}", "{дата}"];

const STAGE_TONE: Record<ReminderStage, "blue" | "yellow" | "red"> = {
  before: "blue",
  due: "yellow",
  overdue_soft: "yellow",
  overdue_hard: "red",
};

export default function TemplatesSettings() {
  const {
    templates,
    user,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
  } = useData();
  const isAdmin = user.role === "admin";
  const [modal, setModal] = useState<"new" | MessageTemplate | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const makeDefault = async (t: MessageTemplate) => {
    setBusy(t.id);
    try {
      await setDefaultTemplate(t.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось назначить основным");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (t: MessageTemplate) => {
    if (templates.length === 1) {
      alert("Нельзя удалить единственный шаблон — иначе напоминания отправлять будет нечем");
      return;
    }
    if (!confirm(`Удалить шаблон «${t.name}»?`)) return;
    setBusy(t.id);
    try {
      await deleteTemplate(t.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold tracking-tight">Шаблоны сообщений</h2>
            <p className="mt-1 text-sm text-mute">
              Тексты напоминаний для WhatsApp. Шаблон, закреплённый за стадией
              лесенки, подставляется в очередь «Работа с долгом → Напоминания».
              Подстановки: {PLACEHOLDERS.join(" ")}.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setModal("new")}
              className="shrink-0 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
            >
              + Создать шаблон
            </button>
          )}
        </div>

        {templates.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Шаблонов пока нет"
            text="Создайте первый шаблон напоминания об оплате."
            {...(isAdmin ? { action: "Создать шаблон", onAction: () => setModal("new") } : {})}
          />
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-line">
            {templates.map((t) => (
              <div key={t.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{t.name}</h3>
                    {t.isDefault && <Badge tone="green">Основной</Badge>}
                    {t.stage && <Badge tone={STAGE_TONE[t.stage]}>{REMINDER_STAGE_LABEL[t.stage]}</Badge>}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-2">
                      {!t.isDefault && (
                        <button
                          onClick={() => makeDefault(t)}
                          disabled={busy === t.id}
                          title="Сделать основным"
                          className="rounded-[16px] border border-line p-1.5 text-mute transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
                        >
                          <Star size={14} aria-hidden />
                        </button>
                      )}
                      <button
                        onClick={() => setModal(t)}
                        title="Редактировать"
                        className="rounded-[16px] border border-line p-1.5 text-mute transition-colors hover:border-brand/40 hover:text-ink"
                      >
                        <Pencil size={14} aria-hidden />
                      </button>
                      <button
                        onClick={() => remove(t)}
                        disabled={busy === t.id}
                        title="Удалить"
                        className="rounded-[16px] border border-line p-1.5 text-mute transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-mute">{t.body}</p>
              </div>
            ))}
          </div>
        )}
        {!isAdmin && <p className="mt-2 text-xs text-mute">Шаблоны меняет администратор.</p>}
      </Card>

      {modal && (
        <TemplateModal
          initial={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          usedStages={templates.filter((t) => t !== modal).map((t) => t.stage).filter(Boolean) as ReminderStage[]}
          onSubmit={async (input) => {
            if (modal === "new") await addTemplate(input);
            else await updateTemplate(modal.id, input);
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function TemplateModal({
  initial,
  usedStages,
  onClose,
  onSubmit,
}: {
  initial: MessageTemplate | null;
  usedStages: ReminderStage[];
  onClose: () => void;
  onSubmit: (input: { name: string; body: string; stage: ReminderStage | null }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [stage, setStage] = useState<ReminderStage | "">(initial?.stage ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "" && body.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), body: body.trim(), stage: stage || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-scrim" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="template-title" className="font-semibold tracking-tight">
            {initial ? "Редактировать шаблон" : "Новый шаблон"}
          </h2>
          <p className="text-sm text-mute">
            Подстановки: {PLACEHOLDERS.join(" ")}
          </p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Название</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Напоминание об оплате" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Текст сообщения</span>
            <textarea
              className={`${field} min-h-32 resize-y`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Здравствуйте, {имя}! Напоминаем про платёж {сумма}…"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Стадия в лесенке напоминаний</span>
            <select
              className={field}
              value={stage}
              onChange={(e) => setStage(e.target.value as ReminderStage | "")}
            >
              <option value="">Не в лесенке — только вручную</option>
              {(Object.keys(REMINDER_STAGE_LABEL) as ReminderStage[]).map((s) => (
                <option key={s} value={s}>
                  {REMINDER_STAGE_LABEL[s]}
                  {usedStages.includes(s) ? " (заменит текущий)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Сохраняем…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Сохранить
          </button>
        </footer>
      </form>
    </div>
  );
}
