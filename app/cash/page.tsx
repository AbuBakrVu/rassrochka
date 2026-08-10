"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ArrowDownToLine,
  SlidersHorizontal,
  Handshake,
  PiggyBank,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money, longDate } from "@/lib/schedule";
import { useData, type CashKind } from "@/lib/store";
import { cashSummary } from "@/lib/cash";
import { todayIso } from "@/lib/derive";

const kindMeta: Record<
  CashKind,
  { label: string; icon: typeof Wallet; bg: string; text: string }
> = {
  purchase: {
    label: "Закупка",
    icon: ShoppingCart,
    bg: "bg-danger-soft",
    text: "text-danger",
  },
  payment: {
    label: "Платёж клиента",
    icon: ArrowDownToLine,
    bg: "bg-good-soft",
    text: "text-good",
  },
  adjustment: {
    label: "Корректировка",
    icon: SlidersHorizontal,
    bg: "bg-brand-soft",
    text: "text-brand",
  },
  payout: {
    label: "Выплата соинвестору",
    icon: Handshake,
    bg: "bg-danger-soft",
    text: "text-danger",
  },
  capital_deposit: {
    label: "Пополнение капитала",
    icon: PiggyBank,
    bg: "bg-good-soft",
    text: "text-good",
  },
  capital_withdrawal: {
    label: "Снятие капитала",
    icon: PiggyBank,
    bg: "bg-danger-soft",
    text: "text-danger",
  },
};

const filters = [
  { key: "all", label: "Все", kinds: null },
  { key: "payment", label: "Приход", kinds: ["payment"] },
  { key: "purchase", label: "Расход", kinds: ["purchase"] },
  { key: "adjustment", label: "Корректировки", kinds: ["adjustment"] },
  { key: "payout", label: "Выплаты соинвесторам", kinds: ["payout"] },
  {
    key: "capital",
    label: "Капитал соинвесторов",
    kinds: ["capital_deposit", "capital_withdrawal"],
  },
] as const satisfies { key: string; label: string; kinds: readonly CashKind[] | null }[];

const input =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

function AdjustmentModal({ onClose }: { onClose: () => void }) {
  const { addCashAdjustment } = useData();
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());

  const ready = Number(amount) > 0 && title.trim() !== "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    addCashAdjustment({
      amount: direction === "in" ? Number(amount) : -Number(amount),
      title: title.trim(),
      date,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Закрыть окно"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-adj-title"
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <h2
              id="cash-adj-title"
              className="text-lg font-semibold tracking-tight"
            >
              Движение по кассе
            </h2>
            <p className="text-sm text-mute">
              Внесение или изъятие вне сделок
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

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["in", "Внести", Plus],
                ["out", "Изъять", Minus],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDirection(key)}
                aria-pressed={direction === key}
                className={`flex items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${
                  direction === key
                    ? "border-brand bg-brand-soft font-medium text-brand-deep"
                    : "border-line bg-canvas text-mute hover:text-ink"
                }`}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Сумма</span>
            <div className="relative">
              <input
                autoFocus
                inputMode="numeric"
                className={`${input} pr-9 text-lg font-semibold`}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">
                ₽
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Основание</span>
            <input
              className={input}
              placeholder="Например: инкассация или пополнение оборотных"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Дата</span>
            <input
              type="date"
              className={input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">
          <p className="mr-auto text-sm text-mute">
            {ready ? "Можно сохранять" : "Укажите сумму и основание"}
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
            disabled={!ready}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Провести
          </button>
        </footer>
      </form>
    </div>
  );
}

export default function CashPage() {
  const { cash, cashOpeningBalance } = useData();
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [modal, setModal] = useState(false);

  const monthPrefix = todayIso().slice(0, 7);
  const summary = useMemo(
    () => cashSummary(cashOpeningBalance, cash, monthPrefix),
    [cash, monthPrefix]
  );

  const activeKinds = filters.find((f) => f.key === filter)?.kinds ?? null;
  const list = useMemo(
    () =>
      [...cash]
        .filter((t) => !activeKinds || (activeKinds as readonly string[]).includes(t.kind))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [cash, activeKinds]
  );

  const kpis = [
    {
      label: "Остаток в кассе",
      value: money(summary.balance),
      note: `открытие ${money(cashOpeningBalance)}`,
      cls: summary.balance < 0 ? "text-danger" : "",
      icon: Wallet,
    },
    {
      label: "Приход за август",
      value: money(summary.monthIncome),
      note: "платежи клиентов и внесения",
      cls: "text-good",
      icon: TrendingUp,
    },
    {
      label: "Расход за август",
      value: money(summary.monthExpense),
      note: "закупки товара и изъятия",
      cls: "text-danger",
      icon: TrendingDown,
    },
    {
      label: "Оборот за всё время",
      value: money(summary.income + summary.expense),
      note: `${cash.length} операций`,
      cls: "",
      icon: SlidersHorizontal,
    },
  ];

  return (
    <>
      <PageHeader
        title="Кассы"
        subtitle="Движение денег: закупки, платежи и корректировки"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(({ label, value, note, cls, icon: Icon }) => (
            <Card key={label} className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-mute">{label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                  <Icon size={17} aria-hidden />
                </span>
              </div>
              <p
                className={`mt-2 text-[26px] font-semibold tracking-tight ${cls}`}
              >
                {value}
              </p>
              <p className="mt-1 text-sm text-mute">{note}</p>
            </Card>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Фильтр операций"
          >
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-[10px] px-3.5 py-2 text-sm transition-colors ${
                  filter === f.key
                    ? "bg-brand font-medium text-white"
                    : "border border-line bg-surface text-mute hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setModal(true)}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep"
          >
            + Движение по кассе
          </button>
        </div>

        <Card className="mt-4 overflow-hidden">
          {list.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Операций нет"
              text="По этому фильтру движений не было. Закупки появляются при создании сделки, приход — при приёме платежа."
            />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((t) => {
                const meta = kindMeta[t.kind];
                const row = (
                  <>
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${meta.bg} ${meta.text}`}
                    >
                      <meta.icon size={16} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs text-mute">
                        {meta.label} · {longDate(new Date(t.date))}
                        {t.note ? ` · ${t.note}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold whitespace-nowrap ${
                        t.amount >= 0 ? "text-good" : "text-ink"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(t.amount))}
                    </span>
                  </>
                );
                return (
                  <li key={t.id}>
                    {t.dealId ? (
                      <Link
                        href={`/deals/${t.dealId}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-canvas sm:px-6"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-3 sm:px-6">
                        {row}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <p className="mt-3 text-xs text-mute">
          Закупка списывается при создании сделки, приход — при приёме
          платежа. Строки со сделкой кликабельны.
        </p>
      </div>

      {modal && <AdjustmentModal onClose={() => setModal(false)} />}
    </>
  );
}
