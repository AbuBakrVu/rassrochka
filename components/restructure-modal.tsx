"use client";

import { useEffect, useState } from "react";
import { X, Check, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { money } from "@/lib/schedule";
import { todayIso } from "@/lib/derive";

const terms = [3, 6, 9, 12, 18, 24];

const reasons = [
  "Снижение дохода клиента",
  "Технический сбой в оплате",
  "Личная просьба клиента",
  "Другое",
];

const input =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

export type RestructureSubmit = (input: {
  months: number;
  from: string;
  reason: string;
  comment?: string;
}) => Promise<void>;

export default function RestructureModal({
  dealId,
  clientName,
  remaining,
  currentMonthly,
  onClose,
  onSubmit,
}: {
  dealId: string;
  clientName: string;
  remaining: number;
  currentMonthly: number;
  onClose: () => void;
  onSubmit: RestructureSubmit;
}) {
  const [months, setMonths] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const newMonthly = months ? remaining / months : null;
  const diff = newMonthly !== null ? newMonthly - currentMonthly : 0;
  const ready = months !== null && reason !== "" && date !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ months: months!, from: date, reason, comment: comment.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить график");
      setSaving(false);
      return;
    }
    setSaved(true);
    setTimeout(onClose, 1300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Закрыть окно"
        className="absolute inset-0 bg-scrim"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="restructure-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <h2
              id="restructure-title"
              className="text-lg font-semibold tracking-tight"
            >
              Изменить график
            </h2>
            <p className="text-sm text-mute">
              {clientName} · {dealId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-[10px] p-2 text-mute hover:bg-canvas hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="rounded-[12px] bg-canvas px-4 py-3">
            <p className="text-sm text-mute">Остаток к пересчёту</p>
            <p className="text-lg font-semibold tracking-tight">
              {money(remaining)}
            </p>
            <p className="text-xs text-mute">
              Сейчас {money(currentMonthly)} в месяц
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">
              Новый срок рассрочки
              <span className="ml-1 text-danger" aria-hidden>
                *
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              {terms.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMonths(t)}
                  aria-pressed={months === t}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    months === t
                      ? "bg-brand font-medium text-on-brand"
                      : "border border-line bg-canvas text-mute hover:text-ink"
                  }`}
                >
                  {t} мес
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Дата первого платежа по новому графику
              <span className="ml-1 text-danger" aria-hidden>
                *
              </span>
            </span>
            <input
              type="date"
              className={input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium">
              Причина реструктуризации
              <span className="ml-1 text-danger" aria-hidden>
                *
              </span>
            </span>
            <div className="flex flex-col gap-2">
              {reasons.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-sm transition-colors ${
                    reason === r
                      ? "border-brand bg-brand-soft font-medium text-brand-deep"
                      : "border-line bg-canvas text-ink hover:border-brand/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[var(--color-brand)]"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Комментарий <span className="text-xs text-mute">необязательно</span>
            </span>
            <textarea
              rows={2}
              className={`${input} resize-y`}
              placeholder="Например: клиент попросил перенести на осень"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>

          {newMonthly !== null && (
            <div className="rounded-[12px] bg-brand-soft px-4 py-3.5">
              <p className="text-xs font-medium tracking-wide text-brand-deep uppercase">
                Новый ежемесячный платёж
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-xl font-semibold text-ink">
                  {money(newMonthly)}
                </p>
                <span
                  className={`flex items-center gap-1 text-sm font-medium ${
                    diff < -1
                      ? "text-good"
                      : diff > 1
                        ? "text-danger"
                        : "text-mute"
                  }`}
                >
                  {diff < -1 ? (
                    <TrendingDown size={14} aria-hidden />
                  ) : diff > 1 ? (
                    <TrendingUp size={14} aria-hidden />
                  ) : (
                    <Minus size={14} aria-hidden />
                  )}
                  {money(Math.abs(diff))}
                </span>
              </div>
              <p className="mt-1 text-sm text-brand-deep">
                вместо {money(currentMonthly)} — старый график будет заменён
                новым на {months} мес.
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">
          <p
            className="mr-auto text-sm"
            role="status"
            aria-live="polite"
          >
            {error ? (
              <span className="text-danger">{error}</span>
            ) : saved ? (
              "График обновлён"
            ) : saving ? (
              "Сохраняем…"
            ) : ready ? (
              <span className="text-mute">Можно сохранять</span>
            ) : (
              <span className="text-mute">Выберите срок, дату и причину</span>
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving || saved}
            className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            <Check size={15} aria-hidden />
            {saved ? "Сохранено" : "Сохранить новый график"}
          </button>
        </footer>
      </form>
    </div>
  );
}
