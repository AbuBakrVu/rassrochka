"use client";

import { useState } from "react";
import { useData } from "@/lib/store";
import { OUTCOME_LABEL, type ContactOutcome } from "@/lib/collections";
import { todayIso } from "@/lib/status";
import { addMonthsIso, money } from "@/lib/schedule";

// «Записать звонок» по просроченной сделке: итог звонка, для обещания —
// дата и сумма, для перезвона — дата. Общий для страницы «Просрочки» и
// карточки сделки.

const OUTCOMES: ContactOutcome[] = ["promise", "callback", "no_answer", "refused", "paid", "other"];

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:bg-surface";

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function ContactModal({
  dealId,
  clientName,
  phone,
  overdueSum,
  onClose,
}: {
  dealId: string;
  clientName: string;
  phone?: string;
  overdueSum?: number;
  onClose: () => void;
}) {
  const { addContact } = useData();
  const today = todayIso();
  const [outcome, setOutcome] = useState<ContactOutcome>("promise");
  const [dueDate, setDueDate] = useState(addDays(today, 3));
  const [amount, setAmount] = useState(overdueSum ? String(Math.round(overdueSum)) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsDate = outcome === "promise" || outcome === "callback";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (needsDate && (!dueDate || dueDate < today)) {
      setError("Укажите дату не раньше сегодняшней");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sum = Number(amount.replace(/\s/g, ""));
      await addContact(dealId, {
        outcome,
        ...(needsDate ? { dueDate } : {}),
        ...(outcome === "promise" && sum > 0 ? { amount: sum } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onClose();
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
        aria-labelledby="contact-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="contact-title" className="font-semibold tracking-tight">Записать звонок</h2>
          <p className="text-sm text-mute">
            {clientName} · {dealId}
            {phone && phone !== "—" && (
              <>
                {" · "}
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="font-medium text-brand">
                  {phone}
                </a>
              </>
            )}
          </p>
          {overdueSum ? <p className="mt-1 text-sm text-danger">Просрочено {money(overdueSum)}</p> : null}
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-2 text-sm font-medium">Итог звонка</legend>
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(o)}
                aria-pressed={outcome === o}
                className={`rounded-[12px] border px-3 py-2.5 text-left text-sm ${
                  outcome === o ? "border-brand bg-brand-soft font-medium text-brand-deep" : "border-line text-mute hover:text-ink"
                }`}
              >
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </fieldset>

          {needsDate && (
            <div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  {outcome === "promise" ? "Обещал оплатить до" : "Перезвонить"}
                </span>
                <input type="date" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
              </label>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {[
                  ["Завтра", addDays(today, 1)],
                  ["Через 3 дня", addDays(today, 3)],
                  ["Через неделю", addDays(today, 7)],
                  ["Через месяц", addMonthsIso(today, 1)],
                ].map(([label, iso]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDueDate(iso)}
                    className="rounded-full border border-line px-2.5 py-1 text-mute hover:text-ink"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {outcome === "promise" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Сколько обещал, ₽</span>
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Комментарий</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Например: задержали зарплату, заплатит частями"
              className={`${field} min-h-20 resize-y`}
            />
          </label>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm text-danger" role="status" aria-live="polite">{error}</p>
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button type="submit" disabled={saving} className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:opacity-50">
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </footer>
      </form>
    </div>
  );
}
