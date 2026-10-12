"use client";

// Форма заявки на подключение с лендинга → /api/public/lead.

import { useState } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";

const input =
  "w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

export default function LandingLeadForm() {
  const [form, setForm] = useState({ name: "", phone: "", company: "", comment: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Не удалось отправить заявку");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить заявку");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center py-10 text-center" role="status">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good">
          <CircleCheck size={28} aria-hidden />
        </span>
        <p className="text-xl font-semibold tracking-tight">Заявка отправлена</p>
        <p className="mt-1 max-w-xs text-sm text-mute">
          Свяжемся с вами в течение рабочего дня и покажем CRM на ваших данных.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Как к вам обращаться</span>
          <input className={input} required autoComplete="name" value={form.name} onChange={set("name")} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Телефон</span>
          <input
            className={input}
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 900 000-00-00"
            value={form.phone}
            onChange={set("phone")}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Компания <span className="font-normal text-mute">— необязательно</span>
        </span>
        <input className={input} autoComplete="organization" value={form.company} onChange={set("company")} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Сколько сделок ведёте и в чём сейчас <span className="font-normal text-mute">— необязательно</span>
        </span>
        <textarea
          className={`${input} min-h-[88px] resize-y`}
          placeholder="Например: около 300 активных, Excel и тетрадь"
          value={form.comment}
          onChange={set("comment")}
        />
      </label>
      {/* Ловушка для ботов: человек это поле не видит */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
        value={form.website}
        onChange={set("website")}
      />
      <label className="flex items-start gap-2.5 text-sm text-mute">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        Согласен на обработку персональных данных для связи по заявке
      </label>
      {error && (
        <p className="rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
      >
        {sending ? "Отправляем…" : "Отправить заявку"}
        {!sending && <ArrowRight size={15} aria-hidden />}
      </button>
    </form>
  );
}
