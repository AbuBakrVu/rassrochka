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
  ReceiptText,
} from "lucide-react";
import { clientById, paidCount, dealState, ruPlural, type Deal } from "@/lib/data";
import { scheduleForDeal, paidTotal } from "@/lib/schedule";
import { allocatePayment } from "@/lib/payments";
import { todayIso } from "@/lib/derive";
import { useData } from "@/lib/store";
import { Badge } from "@/components/ui";
import { money as moneyFmt } from "@/lib/schedule";
import { paymentTitle, receiptPath } from "@/lib/receipts";

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
  const { deals, clients, paidPayments, acceptPayment, cash } = useData();
  const [query, setQuery] = useState("");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [method, setMethod] =
    useState<(typeof methods)[number]["key"]>("cash");
  const [date, setDate] = useState(todayIso());
  const [saved, setSaved] = useState(false);
  // Последний id в кассе до проведения — всё, что новее, записал этот платёж
  const [cashIdBefore, setCashIdBefore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      // Платёж принимается только по выданной сделке — заявку сначала
      // одобряют переводом в «Активна» (там же проводится закупка)
      .filter((d) => dealState(d) === "active")
      .map((d) => {
        const client = clientById(clients, d.clientId);
        const paid = paidCount(d, paidPayments);
        // Реальный график, а не amount/months «в лоб» — после
        // реструктуризации взносы могут отличаться от простого деления
        const schedule = scheduleForDeal(d, paid);
        const next = schedule.find((p) => p.status === "due");
        const paidSum = paidTotal(schedule);
        return {
          deal: d,
          phone: client?.phone ?? "",
          schedule,
          nextAmount: next?.amount ?? 0,
          remaining: d.amount - paidSum,
        };
      })
      .filter(
        ({ deal: d, phone }) =>
          q === "" ||
          d.client.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          (qd.length >= 3 && digits(phone).includes(qd))
      );
  }, [query, deals, clients, paidPayments]);

  // Запасной объект: после последнего взноса сделка закрывается и пропадает
  // из rows (dealState больше не active/pending), а модалка ещё 1.3с
  // показывает «Платёж принят» — без этого JSX упал бы на null
  const selected = deal
    ? (rows.find((r) => r.deal.id === deal.id) ?? {
        deal,
        phone: "",
        schedule: [],
        nextAmount: Math.round(deal.amount / deal.months),
        remaining: deal.amount,
      })
    : null;

  const pick = (d: Deal) => {
    setDeal(d);
    const row = rows.find((r) => r.deal.id === d.id);
    setAmountInput(row ? String(Math.round(row.nextAmount)) : "");
  };

  const amount = Number(amountInput.replace(/\s/g, ""));
  // Тот же расчёт, что на сервере (lib/payments.ts): сколько взносов
  // закроет сумма и сколько останется в счёт следующего. В графике
  // ближайший взнос уже уменьшен на внесённое ранее, поэтому credit = 0
  const allocation = selected
    ? allocatePayment(
        selected.schedule.filter((p) => p.status === "due").map((p) => p.amount),
        0,
        0,
        Number.isFinite(amount) ? amount : 0
      )
    : null;
  const amountValid = allocation?.ok === true;
  const coveredCount = allocation?.ok ? allocation.paid : 0;
  const leftover = allocation?.ok ? allocation.credit : 0;

  const ready = date !== "" && amountValid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !deal) return;
    setError(null);
    try {
      setCashIdBefore(cash.reduce((max, t) => Math.max(max, Number(t.id)), 0));
      await acceptPayment(deal.id, { date, method, amount });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось принять платёж");
    }
  };

  // После проведения — предложить отправить клиенту квитанцию. Переплата
  // пишет в кассу по записи на каждый закрытый взнос — ссылка на каждую.
  const newPayments =
    saved && deal && cashIdBefore !== null
      ? cash.filter(
          (t) =>
            t.dealId === deal.id &&
            t.kind === "payment" &&
            t.amount > 0 &&
            t.installmentNumber &&
            !t.reversesId &&
            Number(t.id) > cashIdBefore
        )
      : [];
  const payer = deal ? clientById(clients, deal.clientId) : undefined;

  const sendReceipt = () => {
    if (!deal || !payer || newPayments.length === 0) return;
    const firstName = payer.name.split(" ")[1] ?? payer.name;
    const total = newPayments.reduce((s, t) => s + t.amount, 0);
    const url = (id: string) => `${window.location.origin}${receiptPath(payer.portalToken, id)}`;
    const receipts =
      newPayments.length === 1
        ? `Квитанция: ${url(newPayments[0].id)}`
        : "Квитанции:\n" +
          newPayments
            .map((t) => `${paymentTitle(t.title.startsWith("Частичная оплата") ? "partial" : "installment", t.installmentNumber, deal.months)} — ${url(t.id)}`)
            .join("\n");
    const text =
      `${firstName}, здравствуйте! Платёж ${moneyFmt(total)} по рассрочке «${deal.product}» получен. Спасибо!\n\n` +
      receipts;
    window.open(
      `https://wa.me/${payer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Закрыть окно"
        className="absolute inset-0 bg-scrim"
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
                rows.map(({ deal: d, phone, nextAmount, remaining }) => (
                  <li key={d.id}>
                    <button
                      onClick={() => pick(d)}
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
                          {money(nextAmount)}
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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand">
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

              <div>
                <span className="mb-1.5 block text-sm font-medium">Сумма платежа</span>
                <div className="relative">
                  <input
                    inputMode="numeric"
                    className={`${input} pr-9 text-lg font-semibold ${
                      !amountValid ? "border-danger focus:border-danger" : ""
                    }`}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value.replace(/[^\d]/g, ""))}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">
                    ₽
                  </span>
                </div>
                {!amountValid ? (
                  <p className="mt-1.5 text-xs text-danger">
                    {allocation && !allocation.ok && allocation.error === "TOO_HIGH"
                      ? `Больше остатка долга — можно принять не больше ${money(allocation.max)}`
                      : "Введите сумму больше нуля"}
                  </p>
                ) : coveredCount === 0 ? (
                  <p className="mt-1.5 text-xs text-mute">
                    Частичная оплата: взнос закроется, когда клиент доплатит{" "}
                    {money(Math.max(selected!.nextAmount - amount, 0))}.
                  </p>
                ) : coveredCount > 1 || leftover > 0 ? (
                  <p className="mt-1.5 text-xs text-mute">
                    Закроет {coveredCount}{" "}
                    {ruPlural(coveredCount, "взнос", "взноса", "взносов")}
                    {leftover > 0 && `, ещё ${money(leftover)} пойдёт в счёт следующего`}.
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-mute">
                    По умолчанию — очередной взнос по графику. Впишите
                    фактическую сумму: меньше — частичная оплата, больше —
                    закроет и следующие взносы.
                  </p>
                )}
              </div>

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

              <div className="flex items-center gap-2.5 rounded-[12px] bg-brand-soft px-4 py-3 text-sm">
                <CalendarDays
                  size={16}
                  className="shrink-0 text-brand"
                  aria-hidden
                />
                <p className="text-brand-deep">
                  После платежа остаток по сделке —{" "}
                  {money(Math.max(selected!.remaining - (amountValid ? amount : 0), 0))}
                </p>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">
              <p
                className={`mr-auto text-sm ${error ? "text-danger" : "text-mute"}`}
                role="status"
                aria-live="polite"
              >
                {error
                  ? error
                  : saved
                    ? "Платёж принят — отправьте клиенту квитанцию"
                    : ready
                      ? "Можно проводить"
                      : !amountValid
                        ? "Проверьте сумму платежа"
                        : "Укажите дату платежа"}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink"
              >
                {saved ? "Готово" : "Отмена"}
              </button>
              {saved ? (
                <button
                  type="button"
                  onClick={sendReceipt}
                  disabled={newPayments.length === 0 || !payer}
                  className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
                >
                  <ReceiptText size={15} aria-hidden />
                  Отправить квитанцию
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!ready}
                  className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
                >
                  <Check size={15} aria-hidden />
                  Принять платёж
                </button>
              )}
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
