"use client";

import { useEffect, useState } from "react";
import { Globe, ExternalLink, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import CopyLinkButton from "@/components/copy-link";
import { useData } from "@/lib/store";
import { APPLY_DEFAULTS, type ApplySettings } from "@/lib/apply";

// Настройки → «Онлайн-заявка»: калькулятор и заявка для клиентов (/apply)
// и показ предодобренного лимита в кабинете клиента.

const TERM_OPTIONS = [2, 3, 4, 5, 6, 8, 9, 10, 12, 18, 24];

const input =
  "w-28 rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

export default function ApplySettingsCard() {
  const { user } = useData();
  const isAdmin = user.role === "admin";
  const [saved, setSaved] = useState<{ apply: ApplySettings; portalShowLimit: boolean } | null>(null);
  const [draft, setDraft] = useState<{ apply: ApplySettings; portalShowLimit: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch("/api/settings/apply")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { apply: ApplySettings; portalShowLimit: boolean }) => {
        if (cancelled) return;
        setSaved(data);
        setDraft(data);
        setOrigin(window.location.origin);
      })
      .catch(() => !cancelled && setMessage({ text: "Не удалось загрузить настройки", error: true }));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card className="p-5 sm:p-6">
        <p className="text-sm text-mute">Онлайн-заявку настраивает администратор.</p>
      </Card>
    );
  }
  if (!draft || !saved) {
    return (
      <Card className="p-5 sm:p-6">
        <p className="text-sm text-mute">{message?.text ?? "Загружаем…"}</p>
      </Card>
    );
  }

  const a = draft.apply;
  const setApply = (patch: Partial<ApplySettings>) => setDraft({ ...draft, apply: { ...a, ...patch } });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/apply", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Не удалось сохранить");
      setSaved(draft);
      setMessage({ text: "Сохранено" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Не удалось сохранить", error: true });
    } finally {
      setSaving(false);
    }
  };

  const embed = `<iframe src="${origin}/apply?embed=1" style="width:100%;max-width:480px;height:1100px;border:0"></iframe>`;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Globe size={17} className="text-brand" aria-hidden />
          <h2 className="font-semibold tracking-tight">Онлайн-заявка и калькулятор</h2>
        </div>
        <p className="mt-1 text-sm text-mute">
          Страница, где клиент сам считает ежемесячный платёж и оставляет заявку. Заявка появляется в
          «Сделках» как новая, без ответственного; клиент находится по телефону или заводится сам — с
          отметкой о согласии на обработку данных.
        </p>

        <label className="mt-4 flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={a.enabled}
            onChange={(e) => setApply({ enabled: e.target.checked })}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
          Принимать заявки с сайта
        </label>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Наценка, %</span>
            <input
              inputMode="decimal"
              value={String(a.markupPct)}
              onChange={(e) => setApply({ markupPct: Math.min(200, Math.max(0, Number(e.target.value.replace(",", ".")) || 0)) })}
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Первый взнос от, %</span>
            <input
              inputMode="decimal"
              value={String(a.minDownPct)}
              onChange={(e) => setApply({ minDownPct: Math.min(90, Math.max(0, Number(e.target.value.replace(",", ".")) || 0)) })}
              className={input}
            />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-sm font-medium">Сроки на выбор, месяцев</legend>
          <div className="flex flex-wrap gap-2">
            {TERM_OPTIONS.map((t) => {
              const on = a.terms.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const terms = on ? a.terms.filter((x) => x !== t) : [...a.terms, t].sort((x, y) => x - y);
                    setApply({ terms: terms.length ? terms : APPLY_DEFAULTS.terms });
                  }}
                  className={`min-w-11 rounded-full border px-3 py-1.5 text-sm font-medium ${
                    on ? "border-brand bg-brand text-on-brand" : "border-line text-mute hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <p className="text-sm" role="status" aria-live="polite">
            {message && <span className={message.error ? "text-danger" : "text-good"}>{message.text}</span>}
          </p>
        </div>
      </Card>

      {saved.apply.enabled && (
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold tracking-tight">Как дать клиентам</h2>
          <p className="mt-1 text-sm text-mute">
            Ссылку — в соцсети, мессенджеры и на визитки. Код — на свой сайт: калькулятор встанет прямо
            на страницу.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="min-w-48 flex-1">
              <CopyLinkButton path="/apply" />
            </div>
            <a
              href="/apply"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink"
            >
              <ExternalLink size={15} aria-hidden /> Открыть
            </a>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium">Код для сайта</span>
            <textarea
              readOnly
              value={embed}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-20 w-full resize-none rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs"
            />
          </label>
          <p className="mt-2 text-xs text-mute">
            Кнопка «В рассрочку» у товара: ссылка вида{" "}
            <code className="rounded bg-canvas px-1">{origin}/apply?price=45000&amp;months=6&amp;product=Телефон</code>{" "}
            сразу подставит цену, срок и название.
          </p>
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-brand" aria-hidden />
          <h2 className="font-semibold tracking-tight">Предодобренный лимит в кабинете</h2>
        </div>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.portalShowLimit}
            onChange={(e) => setDraft({ ...draft, portalShowLimit: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
          />
          <span>
            Показывать клиенту «Вам предварительно одобрено до …»
            <span className="block text-mute">
              Только клиентам без просрочки, не из чёрного списка и без повышенного риска. Сумма —
              свободный остаток лимита (раздел «Лимиты клиентов»). Сохраняется кнопкой выше.
            </span>
          </span>
        </label>
      </Card>
    </div>
  );
}
