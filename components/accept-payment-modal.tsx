"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Search,
  SearchX,
  ArrowLeft,
  Check,
  Banknote,
  CreditCard,
  Landmark,
  CalendarDays,
} from "lucide-react";
import { deals, clients, paidPayments, type Deal } from "@/lib/data";
import { Badge } from "@/components/ui";

const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";

const input =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

const methods = [
  { key: "cash", label: "Наличные", icon: Banknote },
  { key: "card", label: "Карта", icon: CreditCard },
  { key: "transfer", label: "Перевод", icon: Landmark },
] as const;

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("");

// Нормализуем телефон для поиска: оставляем только цифры
const digits = (s: string) => s.replace(/\D/g, "");

export default function AcceptPaymentModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] =
    useState<(typeof methods)[number]["key"]>("cash");
  const [date, setDate] = useState("2026-08-05");
  const [saved, setSaved] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = digits(query);
    return deals
      .map((d) => {
        const client = clients.find((c) => c.name === d.client);
        const paid = paidPayments[d.id] ?? 0;
        const monthly = Math.round(d.amount / d.months);
        return {
          deal: d,
          phone: client?.phone ?? "",
          monthly,
          remaining: d.amount - monthly * paid,
        };
      })
      .filter(
        ({ deal: d, phone }) =>
          q === "" ||
          d.client.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          (qd.length >= 3 && digits(phone).includes(qd))
      );
  }, [query]);

  const selected = deal
    ? rows.find((r) => r.deal.id === deal.id) ?? {
        deal,
        phone: "",
        monthly: Math.round(deal.amount / deal.months),
        remaining: deal.amount,
      }
    : null;

  const pick = (d: Deal, monthly: number) => {
    setDeal(d);
    setAmount(String(monthly));
  };

  const ready = Number(amount) > 0 && date !== "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSaved(true);
    setTimeout(onClose, 1300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Закрыть окно"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accept-payment-title"
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            {deal && !saved && (
              <button
                onClick={() => setDeal(null)}
                aria-label="Назад к поиску"
                className="rounded-[10px] p-1.5 text-mute hover:bg-canvas hover:text-ink"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            <div>
              <h2
                id="accept-payment-title"
                className="text-lg font-semibold tracking-tight"
              >
                Принять платёж
              </h2>
              <p className="text-sm text-mute">
                {deal
                  ? `${deal.client} · ${deal.id}`
                  : "Найдите клиента или сделку"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-[10px] p-2 text-mute hover:bg-canvas hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        {!deal ? (
          /* Шаг 1 — поиск */
          <div className="flex min-h-0 flex-col">
            <div className="px-6 pt-5">
              <label className="relative block">
                <Search
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mute"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  autoFocus
                  className={`${input} pl-10`}
                  placeholder="ФИО, телефон или номер сделки"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <p className="mt-2 text-xs text-mute">
                Например: «Котова», «+7 921» или «R-1042»
              </p>
            </div>
            <ul className="mt-3 min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
              {rows.length === 0 ? (
                <li className="flex flex-col items-center px-6 py-12 text-center">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <SearchX size={20} aria-hidden />
                  </span>
                  <p className="font-medium">Ничего не нашли</p>
                  <p className="mt-1 max-w-xs text-sm text-mute">
                    Проверьте написание или поищите по номеру сделки — он
                    указан в карточке клиента.
                  </p>
                </li>
              ) : (
                rows.map(({ deal: d, phone, monthly, remaining }) => (
                  <li key={d.id}>
                    <button
                      onClick={() => pick(d, monthly)}
                      className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-canvas"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                        {initials(d.client)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {d.client}
                          </span>
                          <Badge tone={d.statusTone}>{d.status}</Badge>
                        </span>
                        <span className="block truncate text-xs text-mute">
                          {d.id}
                          {phone && ` · ${phone}`}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold whitespace-nowrap">
                          {money(monthly)}
                        </span>
                        <span className="block text-xs whitespace-nowrap text-mute">
                          остаток {money(remaining)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          /* Шаг 2 — платёж */
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
              <div className="flex items-center gap-3 rounded-[12px] bg-canvas px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                  {initials(selected!.deal.client)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {selected!.deal.client}
                  </p>
                  <p className="truncate text-xs text-mute">
                    {selected!.deal.id} · остаток {money(selected!.remaining)}
                  </p>
                </div>
                <Badge tone={selected!.deal.statusTone}>
                  {selected!.deal.status}
                </Badge>
              </div>

              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-medium">Сумма платежа</span>
                  <button
                    type="button"
                    onClick={() => setAmount(String(selected!.monthly))}
                    className="text-xs font-medium text-brand hover:text-brand-deep"
                  >
                    Ежемесячный — {money(selected!.monthly)}
                  </button>
                </span>
                <div className="relative">
                  <input
                    autoFocus
                    inputMode="numeric"
                    className={`${input} pr-9 text-lg font-semibold`}
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">
                    ₽
                  </span>
                </div>
              </label>

              <div>
                <span className="mb-1.5 block text-sm font-medium">
                  Способ оплаты
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {methods.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMethod(key)}
                      aria-pressed={method === key}
                      className={`flex items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${
                        method === key
                          ? "border-brand bg-brand-soft font-medium text-brand-deep"
                          : "border-line bg-canvas text-mute hover:text-ink"
                      }`}
                    >
                      <Icon
                        size={15}
                        className={method === key ? "text-brand" : ""}
                        aria-hidden
                      />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Дата платежа
                </span>
                <input
                  type="date"
                  className={input}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>

              {Number(amount) > 0 && (
                <div className="flex items-center gap-2.5 rounded-[12px] bg-brand-soft px-4 py-3 text-sm">
                  <CalendarDays
                    size={16}
                    className="shrink-0 text-brand"
                    aria-hidden
                  />
                  <p className="text-brand-deep">
                    После платежа остаток по сделке —{" "}
                    {money(Math.max(selected!.remaining - Number(amount), 0))}
                  </p>
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">
              <p
                className="mr-auto text-sm text-mute"
                role="status"
                aria-live="polite"
              >
                {saved
                  ? "Платёж принят"
                  : ready
                    ? "Можно проводить"
                    : "Укажите сумму платежа"}
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
                disabled={!ready || saved}
                className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
              >
                <Check size={15} aria-hidden />
                {saved ? "Платёж принят" : "Принять платёж"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
