"use client";

import { useState } from "react";
import { Settings, Eye, EyeOff, Gauge } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { useData } from "@/lib/store";
import { nav } from "@/components/shell";

// "/settings" сюда не входит — иначе можно было бы случайно скрыть сам
// пункт, которым управляется видимость остальных, и остаться без доступа.
const HIDEABLE = nav.filter((n) => n.href !== "/settings");

export default function SettingsPage() {
  const { user, hiddenNavItems, setHiddenNavItems } = useData();
  const isAdmin = user.role === "admin";

  // Локальный черновик до нажатия «Сохранить»; после успешного сохранения
  // hiddenNavItems подтянется из контекста и сам сравняется с hidden —
  // отдельная синхронизация через эффект не нужна.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(hiddenNavItems));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    hidden.size !== hiddenNavItems.length ||
    hiddenNavItems.some((h) => !hidden.has(h));

  const toggle = (href: string) => {
    if (!isAdmin) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setHiddenNavItems([...hidden]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Настройки"
        subtitle="Компания, интеграции и параметры рассрочки"
      />
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold tracking-tight">Разделы меню</h2>
          <p className="mt-1 text-sm text-mute">
            {isAdmin
              ? "Скройте разделы, которыми компания не пользуется — они пропадут из бокового меню у всех сотрудников."
              : "Изменять видимость разделов может только администратор."}
          </p>

          <div className="mt-4 flex flex-col divide-y divide-line">
            {HIDEABLE.map(({ href, label, icon: Icon }) => {
              const isHidden = hidden.has(href);
              return (
                <div key={href} className="flex items-center gap-3 py-2.5">
                  <Icon size={17} className="shrink-0 text-mute" aria-hidden />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <button
                    type="button"
                    onClick={() => toggle(href)}
                    disabled={!isAdmin}
                    aria-pressed={!isHidden}
                    title={isHidden ? "Скрыт из меню" : "Показан в меню"}
                    className={`flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      isHidden
                        ? "border-line bg-canvas text-mute"
                        : "border-brand/30 bg-brand-soft text-brand-deep"
                    }`}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff size={13} aria-hidden /> Скрыт
                      </>
                    ) : (
                      <>
                        <Eye size={13} aria-hidden /> Показан
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <footer className="mt-4 flex items-center gap-3 border-t border-line pt-4">
              <p className="mr-auto text-sm" role="status" aria-live="polite">
                {error ? (
                  <span className="text-danger">{error}</span>
                ) : saving ? (
                  "Сохраняем…"
                ) : dirty ? (
                  "Есть несохранённые изменения"
                ) : (
                  ""
                )}
              </p>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
              >
                Сохранить
              </button>
            </footer>
          )}
        </Card>

        <CreditLimitCard />

        <p className="mt-4 flex items-center gap-2 text-xs text-mute">
          <Settings size={13} aria-hidden />
          Параметры графиков платежей, штрафов и интеграций — в разработке.
        </p>
      </div>
    </>
  );
}

/** Базовый лимит клиента без истории — от него считаются автоматические лимиты (lib/credit.ts). */
function CreditLimitCard() {
  const { user, clientDefaultLimit, setClientDefaultLimit } = useData();
  const isAdmin = user.role === "admin";
  const [value, setValue] = useState(String(clientDefaultLimit));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const parsed = Number(value.replace(/\s/g, ""));
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const dirty = valid && Math.round(parsed) !== clientDefaultLimit;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setClientDefaultLimit(Math.round(parsed));
      setMessage({ text: "Сохранено" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Не удалось сохранить", error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Gauge size={17} className="text-brand" aria-hidden />
        <h2 className="font-semibold tracking-tight">Лимиты клиентов</h2>
      </div>
      <p className="mt-1 text-sm text-mute">
        Базовый лимит получает клиент без истории. После полностью выплаченной
        сделки лимит растёт до полуторной суммы крупнейшей из них, при
        повышенном риске — снижается вдвое. Администратор может задать лимит
        конкретному клиенту вручную в его карточке. 0 — лимиты не считать.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Базовый лимит, ₽</span>
          <input
            inputMode="numeric"
            value={value}
            disabled={!isAdmin}
            onChange={(e) => setValue(e.target.value)}
            className="w-48 rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface disabled:opacity-60"
          />
        </label>
        {isAdmin && (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        )}
        <p className="text-sm" role="status" aria-live="polite">
          {!valid ? (
            <span className="text-danger">Введите сумму от 0</span>
          ) : message ? (
            <span className={message.error ? "text-danger" : "text-good"}>{message.text}</span>
          ) : null}
        </p>
      </div>
      {!isAdmin && (
        <p className="mt-2 text-xs text-mute">Изменять лимит может только администратор.</p>
      )}
    </Card>
  );
}
