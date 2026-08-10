"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Wallet,
  TrendingUp,
  HandCoins,
  Repeat,
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Ban,
  CheckCircle2,
  Trash2,
  SearchX,
  Phone,
} from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { money, longDate } from "@/lib/schedule";
import { todayIso } from "@/lib/derive";
import { useData } from "@/lib/store";

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

type ModalKind = "payout" | "reinvest" | "deposit" | "withdraw" | "edit" | null;

export default function CoinvestorDetail({ id }: { id: string }) {
  const router = useRouter();
  const {
    coinvestors,
    coinvestorCapitalTx,
    coinvestorProfitTx,
    user,
    updateCoinvestor,
    setCoinvestorActive,
    deleteCoinvestor,
    recordCoinvestorPayout,
    reinvestCoinvestorProfit,
    adjustCoinvestorCapital,
  } = useData();
  const investor = coinvestors.find((c) => c.id === id);
  const isAdmin = user.role === "admin";

  const [modal, setModal] = useState<ModalKind>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "capital" | "profit">("all");
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!investor) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
        <Card>
          <EmptyState
            icon={SearchX}
            title="Соинвестор не найден"
            text={`Записи ${id} нет в системе — возможно, её удалили или ссылка неверна.`}
            action="Ко всем соинвесторам"
            onAction={() => router.push("/coinvestors")}
          />
        </Card>
      </div>
    );
  }

  interface LedgerRow {
    id: string;
    date: string;
    label: string;
    amount: number;
    note?: string;
    group: "capital" | "profit";
  }

  const capitalLabel: Record<string, string> = {
    deposit: "Пополнение капитала",
    withdrawal: "Снятие капитала",
    reinvest: "Реинвестирование · капитал",
  };
  const profitLabel: Record<string, string> = {
    accrual: "Начисление прибыли",
    payout: "Выплата прибыли",
    reinvest: "Реинвестирование · прибыль",
  };

  const rows: LedgerRow[] = [
    ...coinvestorCapitalTx
      .filter((t) => t.coinvestorId === id)
      .map((t) => ({
        id: `cap-${t.id}`,
        date: t.date,
        label: capitalLabel[t.kind],
        amount: t.kind === "withdrawal" ? -t.amount : t.amount,
        note: t.note,
        group: "capital" as const,
      })),
    ...coinvestorProfitTx
      .filter((t) => t.coinvestorId === id)
      .map((t) => ({
        id: `prof-${t.id}`,
        date: t.date,
        label: profitLabel[t.kind],
        amount: t.kind === "accrual" ? t.amount : -t.amount,
        note: t.note,
        group: "profit" as const,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const list = rows.filter((r) => filter === "all" || r.group === filter);

  const toggleActive = async () => {
    setBusy(true);
    try {
      await setCoinvestorActive(investor.id, !investor.active);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось изменить статус");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Удалить соинвестора «${investor.name}»? Это необратимо.`)) return;
    setBusy(true);
    try {
      await deleteCoinvestor(investor.id);
      router.push("/coinvestors");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить");
      setBusy(false);
    }
  };

  const actions = [
    { key: "payout", icon: HandCoins, label: "Выплатить прибыль", disabled: investor.owed <= 0 },
    { key: "reinvest", icon: Repeat, label: "Реинвестировать прибыль", disabled: investor.owed <= 0 },
    { key: "deposit", icon: ArrowDownToLine, label: "Пополнить капитал", disabled: false },
    { key: "withdraw", icon: ArrowUpFromLine, label: "Снять капитал", disabled: investor.capital <= 0 },
    { key: "edit", icon: Pencil, label: "Редактировать", disabled: false },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <button
        onClick={() => router.push("/coinvestors")}
        className="mb-4 flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-sm text-mute hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden /> Все соинвесторы
      </button>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
              {investor.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {investor.name}
                </h1>
                <Badge tone={investor.active ? "green" : "gray"}>
                  {investor.active ? "Активен" : "Приостановлен"}
                </Badge>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-mute">
                <Phone size={13} aria-hidden />
                {investor.phone} · доля {investor.profitSharePct}% · с {longDate(new Date(investor.startedAt))} г.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                disabled={busy}
                className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:opacity-60"
              >
                Действия
                <ChevronDown size={15} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute top-full right-0 z-30 mt-2 w-64 overflow-hidden rounded-[12px] border border-line bg-surface p-1.5 shadow-pop">
                  {actions.map(({ key, icon: Icon, label, disabled }) => (
                    <button
                      key={key}
                      role="menuitem"
                      disabled={disabled}
                      onClick={() => {
                        setMenuOpen(false);
                        setModal(key);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-brand-soft hover:text-brand-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Icon size={16} className="text-brand" aria-hidden />
                      {label}
                    </button>
                  ))}
                  <div className="my-1.5 border-t border-line" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      toggleActive();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-canvas"
                  >
                    {investor.active ? (
                      <Ban size={16} className="text-mute" aria-hidden />
                    ) : (
                      <CheckCircle2 size={16} className="text-good" aria-hidden />
                    )}
                    {investor.active ? "Приостановить" : "Активировать"}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      remove();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-danger hover:bg-danger-soft"
                  >
                    <Trash2 size={16} aria-hidden />
                    Удалить соинвестора
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
          {[
            ["Капитал", money(investor.capital), ""],
            ["Начислено всего", money(investor.accrued), ""],
            ["Выплачено и реинвестировано", money(investor.settled), ""],
            ["К выплате", money(investor.owed), investor.owed > 0 ? "text-warn" : ""],
          ].map(([label, value, cls]) => (
            <div key={label}>
              <p className="text-sm text-mute">{label}</p>
              <p className={`mt-0.5 text-lg font-semibold tracking-tight ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", "Все операции"],
            ["capital", "Капитал"],
            ["profit", "Прибыль"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-[10px] px-3.5 py-2 text-sm transition-colors ${
              filter === key
                ? "bg-brand font-medium text-white"
                : "border border-line bg-surface text-mute hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="mt-3 overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Операций нет"
            text="Здесь появится журнал капитала и начислений прибыли."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                    r.group === "capital" ? "bg-brand-soft text-brand" : "bg-good-soft text-good"
                  }`}
                >
                  {r.group === "capital" ? <Wallet size={16} aria-hidden /> : <TrendingUp size={16} aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="truncate text-xs text-mute">
                    {longDate(new Date(r.date))} г.{r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <span className={`text-sm font-semibold whitespace-nowrap ${r.amount >= 0 ? "text-good" : "text-ink"}`}>
                  {r.amount >= 0 ? "+" : "−"}
                  {money(Math.abs(r.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modal === "payout" && (
        <AmountModal
          title="Выплатить прибыль"
          hint={`Спишется из кассы. К выплате: ${money(investor.owed)}`}
          suggested={investor.owed}
          submitLabel="Выплатить"
          onClose={() => setModal(null)}
          onSubmit={(input) => recordCoinvestorPayout(investor.id, input)}
        />
      )}
      {modal === "reinvest" && (
        <AmountModal
          title="Реинвестировать прибыль"
          hint={`Без движения денег — начисленное станет капиталом. Доступно: ${money(investor.owed)}`}
          suggested={investor.owed}
          submitLabel="Реинвестировать"
          onClose={() => setModal(null)}
          onSubmit={(input) => reinvestCoinvestorProfit(investor.id, input)}
        />
      )}
      {modal === "deposit" && (
        <AmountModal
          title="Пополнить капитал"
          hint="Поступит в кассу компании как реальные деньги."
          suggested={0}
          submitLabel="Пополнить"
          onClose={() => setModal(null)}
          onSubmit={(input) => adjustCoinvestorCapital(investor.id, { direction: "deposit", ...input })}
        />
      )}
      {modal === "withdraw" && (
        <AmountModal
          title="Снять капитал"
          hint={`Спишется из кассы компании. Доступно: ${money(investor.capital)}`}
          suggested={0}
          submitLabel="Снять"
          onClose={() => setModal(null)}
          onSubmit={(input) => adjustCoinvestorCapital(investor.id, { direction: "withdrawal", ...input })}
        />
      )}
      {modal === "edit" && (
        <EditModal
          name={investor.name}
          phone={investor.phone}
          profitSharePct={investor.profitSharePct}
          onClose={() => setModal(null)}
          onSubmit={(input) => updateCoinvestor(investor.id, input)}
        />
      )}
    </div>
  );
}

function AmountModal({
  title,
  hint,
  suggested,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  hint: string;
  suggested: number;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (input: { amount: number; date: string }) => Promise<unknown>;
}) {
  const [amount, setAmount] = useState(suggested > 0 ? String(Math.round(suggested)) : "");
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = Number(amount) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ amount: Number(amount), date });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось провести операцию");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="amount-modal-title"
        className="relative w-full max-w-sm rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="amount-modal-title" className="font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-mute">{hint}</p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Сумма</span>
            <div className="relative">
              <input
                autoFocus
                inputMode="numeric"
                className={`${field} pr-9 text-lg font-semibold`}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">₽</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Дата</span>
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Проводим…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            {submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

function EditModal({
  name: initialName,
  phone: initialPhone,
  profitSharePct: initialPct,
  onClose,
  onSubmit,
}: {
  name: string;
  phone: string;
  profitSharePct: number;
  onClose: () => void;
  onSubmit: (input: { name: string; phone: string; profitSharePct: number }) => Promise<unknown>;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone === "—" ? "" : initialPhone);
  const [percent, setPercent] = useState(String(initialPct));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "" && Number(percent) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), phone, profitSharePct: Number(percent) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-coinvestor-title"
        className="relative w-full max-w-sm rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="edit-coinvestor-title" className="font-semibold tracking-tight">Редактировать соинвестора</h2>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Имя</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Телефон</span>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 911 000-00-00" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Доля прибыли, %</span>
            <input
              inputMode="decimal"
              className={field}
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </label>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Сохраняем…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Сохранить
          </button>
        </footer>
      </form>
    </div>
  );
}
