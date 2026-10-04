"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, SearchX } from "lucide-react";
import { BrandMark, useBrandName } from "@/components/branding";
import { applyQuote, APPLY_MAX_PRICE, normalizeApplySettings, type ApplySettings } from "@/lib/apply";
import { money } from "@/lib/schedule";

// Публичный калькулятор рассрочки и онлайн-заявка (/apply). Без входа и
// без общего стора: условия берутся из /api/public/apply, заявка уходит
// туда же. Сервер пересчитывает суммы сам — расчёт здесь только для
// клиента.

const field =
  "w-full rounded-[12px] border border-line bg-canvas px-3.5 py-3 text-base outline-none transition-colors focus:border-brand focus:bg-surface";

function maskPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const [, a = "", b = "", c = "", e = ""] = /^7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/.exec(d) ?? [];
  let out = "+7";
  if (a) out += ` (${a}`;
  if (a.length === 3) out += ")";
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (e) out += `-${e}`;
  return out;
}

const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 9);
const fmtInput = (v: string) => (v ? new Intl.NumberFormat("ru-RU").format(Number(v)) : "");

export default function ApplyForm({
  initialPrice,
  initialMonths,
  initialProduct,
  embedded,
}: {
  initialPrice?: number;
  initialMonths?: number;
  initialProduct: string;
  embedded: boolean;
}) {
  const brandName = useBrandName();
  const [settings, setSettings] = useState<ApplySettings | null>(null);
  const [off, setOff] = useState(false);

  const [price, setPrice] = useState(initialPrice ? String(Math.min(initialPrice, APPLY_MAX_PRICE)) : "");
  const [pickedMonths, setMonths] = useState<number | null>(initialMonths ?? null);
  const [down, setDown] = useState("");
  const [product, setProduct] = useState(initialProduct);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/apply")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = normalizeApplySettings({ ...(await res.json()), enabled: true });
        if (!cancelled) setSettings(data);
      })
      .catch(() => !cancelled && setOff(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (off) {
    return (
      <Centered>
        <SearchX size={28} className="text-mute" aria-hidden />
        <p className="mt-3 font-medium">Онлайн-заявка сейчас не принимается</p>
        <p className="mt-1 text-sm text-mute">Позвоните или приходите к нам — оформим на месте.</p>
      </Centered>
    );
  }
  if (!settings) {
    return (
      <Centered>
        <Loader2 size={24} className="animate-spin text-mute" aria-hidden />
      </Centered>
    );
  }
  if (sent) {
    return (
      <Centered>
        <CheckCircle2 size={32} className="text-good" aria-hidden />
        <p className="mt-3 text-lg font-semibold">Заявка отправлена</p>
        <p className="mt-1 text-sm text-mute">
          Менеджер {brandName} позвонит вам по номеру {phone} и расскажет, какие документы взять.
        </p>
      </Centered>
    );
  }

  // Срок из ссылки, которого нет в условиях, заменяем ближайшим доступным
  const months = pickedMonths && settings.terms.includes(pickedMonths)
    ? pickedMonths
    : settings.terms.includes(6) ? 6 : settings.terms[0];
  const priceNum = Number(price) || 0;
  const q = applyQuote(settings, priceNum, months, Number(down) || 0);
  const downTooSmall = down !== "" && Number(down) < q.minDown;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    if (priceNum < 1000) return setError("Укажите цену товара");
    if (!consent) return setError("Отметьте согласие на обработку персональных данных");
    setSending(true);
    try {
      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, product, comment, price: priceNum, months, down: q.down, consent, website }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Не удалось отправить заявку");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить заявку");
      setSending(false);
    }
  };

  return (
    <div className={`min-h-screen bg-canvas ${embedded ? "" : "sm:py-10"}`}>
      <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        {!embedded && (
          <header className="flex items-center gap-2.5">
            <BrandMark className="h-10 w-10 rounded-[12px]" iconSize={17} />
            <div>
              <p className="text-sm font-semibold tracking-tight">{brandName}</p>
              <p className="text-xs text-mute">Покупка в рассрочку</p>
            </div>
          </header>
        )}

        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h1 className="text-lg font-semibold tracking-tight">Посчитайте платёж</h1>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium">Цена товара, ₽</span>
            <input
              inputMode="numeric"
              value={fmtInput(price)}
              onChange={(e) => setPrice(digitsOnly(e.target.value))}
              placeholder="Например, 45 000"
              className={field}
            />
          </label>

          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-medium">Срок</legend>
            <div className="flex flex-wrap gap-2">
              {settings.terms.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={months === t}
                  onClick={() => setMonths(t)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${
                    months === t ? "border-brand bg-brand text-on-brand" : "border-line text-mute hover:text-ink"
                  }`}
                >
                  {t} мес.
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
              Первый взнос, ₽
              {q.minDown > 0 && <span className="text-xs font-normal text-mute">не меньше {money(q.minDown)}</span>}
            </span>
            <input
              inputMode="numeric"
              value={fmtInput(down)}
              onChange={(e) => setDown(digitsOnly(e.target.value))}
              placeholder={q.minDown > 0 ? fmtInput(String(q.minDown)) : "0 — без взноса"}
              className={field}
            />
          </label>
          {downTooSmall && <p className="mt-1 text-xs text-warn">Посчитали с минимальным взносом {money(q.minDown)}</p>}

          <div className="mt-5 rounded-[14px] bg-brand-soft p-4" aria-live="polite">
            <p className="text-sm text-brand-deep">Ежемесячный платёж</p>
            <p className="text-[32px] leading-tight font-semibold tracking-tight">
              {priceNum > 0 ? money(q.monthly) : "—"}
            </p>
            {priceNum > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-mute">Стоимость в рассрочку</dt>
                <dd className="text-right font-medium">{money(q.total)}</dd>
                <dt className="text-mute">Первый взнос</dt>
                <dd className="text-right font-medium">{money(q.down)}</dd>
                <dt className="text-mute">Платежей</dt>
                <dd className="text-right font-medium">{months} × {money(q.monthly)}</dd>
              </dl>
            )}
          </div>
          <p className="mt-2 text-xs text-mute">
            Расчёт предварительный. Окончательные условия — после проверки документов.
          </p>
        </section>

        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="text-lg font-semibold tracking-tight">Оставьте заявку</h2>
          <p className="text-sm text-mute">Перезвоним и расскажем, как оформить.</p>
          <div className="mt-4 flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Что хотите купить</span>
              <input value={product} onChange={(e) => setProduct(e.target.value)} maxLength={200} required minLength={2} placeholder="Например, iPhone 16 128 ГБ" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Фамилия и имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required minLength={2} autoComplete="name" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Телефон</span>
              <input
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="+7 (___) ___-__-__"
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Комментарий</span>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Удобное время для звонка, вопросы" className={`${field} min-h-20 resize-y`} />
            </label>
            {/* Ловушка для ботов: людям не видна */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
              aria-hidden
            />
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]" />
              <span>
                Согласен(на) на обработку персональных данных для рассмотрения заявки и связи со мной.
                <details className="mt-1 text-xs text-mute">
                  <summary className="cursor-pointer">Подробнее</summary>
                  <p className="mt-1">
                    Даю согласие {brandName} на обработку моих фамилии, имени, номера телефона и сведений из
                    заявки (сбор, запись, хранение, использование, удаление) для рассмотрения заявки на
                    рассрочку и связи со мной, в соответствии с Федеральным законом № 152-ФЗ «О персональных
                    данных». Согласие действует до его отзыва; отозвать его можно, сообщив об этом менеджеру.
                  </p>
                </details>
              </span>
            </label>
          </div>

          {error && (
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="mt-4 w-full rounded-full bg-brand px-4 py-3.5 text-base font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:opacity-60"
          >
            {sending ? "Отправляем…" : "Отправить заявку"}
          </button>
        </section>
      </form>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex max-w-sm flex-col items-center rounded-card border border-line bg-surface p-8 text-center shadow-card">
        {children}
      </div>
    </div>
  );
}
