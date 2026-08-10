"use client";

import { useMemo, useState } from "react";
import { Handshake, Wallet, TrendingUp, Percent } from "lucide-react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { money, longDate } from "@/lib/schedule";
import { todayIso } from "@/lib/derive";
import { useData, type Coinvestor } from "@/lib/store";

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

/** Начисление за месяц — процент от вложенной суммы, как договорено с инвестором. */
function monthlyAccrual(investor: Coinvestor): number {
  return Math.round((investor.investedAmount * investor.monthlyPercent) / 100);
}

export default function CoinvestorsPage() {
  const { coinvestors, cash, user, addCoinvestor, setCoinvestorActive, recordCoinvestorPayout } =
    useData();
  const isAdmin = user.role === "admin";
  const [addOpen, setAddOpen] = useState(false);
  const [payoutFor, setPayoutFor] = useState<Coinvestor | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const payouts = useMemo(
    () =>
      cash
        .filter((t) => t.kind === "payout")
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [cash]
  );

  const paidTo = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const t of payouts) {
      if (!t.coinvestorId) continue;
      totals[t.coinvestorId] = (totals[t.coinvestorId] ?? 0) + Math.abs(t.amount);
    }
    return totals;
  }, [payouts]);

  const active = coinvestors.filter((c) => c.active);
  const totals = {
    invested: coinvestors.reduce((s, c) => s + c.investedAmount, 0),
    monthlyAccrual: active.reduce((s, c) => s + monthlyAccrual(c), 0),
    paidOut: payouts.reduce((s, t) => s + Math.abs(t.amount), 0),
  };

  const toggle = async (c: Coinvestor) => {
    setBusy(c.id);
    try {
      await setCoinvestorActive(c.id, !c.active);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось изменить статус");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Соинвесторы"
        subtitle="Вложения в оборот компании и ежемесячные выплаты процента"
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-mute">Вложено всего</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                <Wallet size={17} aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-[26px] font-semibold tracking-tight">
              {money(totals.invested)}
            </p>
            <p className="mt-1 text-sm text-mute">{coinvestors.length} соинвесторов</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-mute">Начисление в месяц</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                <Percent size={17} aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-[26px] font-semibold tracking-tight">
              {money(totals.monthlyAccrual)}
            </p>
            <p className="mt-1 text-sm text-mute">по активным вложениям</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-mute">Выплачено всего</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                <TrendingUp size={17} aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-[26px] font-semibold tracking-tight">
              {money(totals.paidOut)}
            </p>
            <p className="mt-1 text-sm text-mute">{payouts.length} выплат</p>
          </Card>
        </div>

        {isAdmin && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep"
            >
              + Добавить соинвестора
            </button>
          </div>
        )}

        <Card className="mt-4 overflow-hidden">
          {coinvestors.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="Соинвесторов пока нет"
              text="Добавьте первого, чтобы вести учёт вложений и ежемесячных выплат."
              {...(isAdmin
                ? { action: "Добавить соинвестора", onAction: () => setAddOpen(true) }
                : {})}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mute">
                    <th className="px-5 py-3 font-medium">Соинвестор</th>
                    <th className="px-5 py-3 font-medium">Вложено</th>
                    <th className="px-5 py-3 font-medium">% в месяц</th>
                    <th className="px-5 py-3 font-medium">Начислено в мес.</th>
                    <th className="px-5 py-3 font-medium">Выплачено всего</th>
                    <th className="px-5 py-3 font-medium">Статус</th>
                    {isAdmin && <th className="px-5 py-3 font-medium" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {coinvestors.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-mute">{c.phone}</p>
                      </td>
                      <td className="px-5 py-3.5">{money(c.investedAmount)}</td>
                      <td className="px-5 py-3.5">{c.monthlyPercent}%</td>
                      <td className="px-5 py-3.5 font-medium">
                        {money(monthlyAccrual(c))}
                      </td>
                      <td className="px-5 py-3.5 text-mute">
                        {money(paidTo[c.id] ?? 0)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={c.active ? "green" : "gray"}>
                          {c.active ? "Активен" : "Приостановлен"}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            {c.active && (
                              <button
                                onClick={() => setPayoutFor(c)}
                                className="rounded-[8px] border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-brand/40 hover:text-ink"
                              >
                                Выплатить
                              </button>
                            )}
                            <button
                              onClick={() => toggle(c)}
                              disabled={busy === c.id}
                              className="rounded-[8px] border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
                            >
                              {c.active ? "Приостановить" : "Активировать"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {payouts.length > 0 && (
          <>
            <h2 className="mt-6 mb-3 font-semibold tracking-tight">
              История выплат
            </h2>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {payouts.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-mute">{longDate(new Date(t.date))}</p>
                    </div>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      −{money(Math.abs(t.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>

      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onCreate={async (input) => {
            await addCoinvestor(input);
            setAddOpen(false);
          }}
        />
      )}

      {payoutFor && (
        <PayoutModal
          investor={payoutFor}
          suggested={monthlyAccrual(payoutFor)}
          onClose={() => setPayoutFor(null)}
          onSubmit={async (input) => {
            await recordCoinvestorPayout(payoutFor.id, input);
            setPayoutFor(null);
          }}
        />
      )}
    </>
  );
}

function AddModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    phone: string;
    investedAmount: number;
    monthlyPercent: number;
    startedAt: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [startedAt, setStartedAt] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "" && Number(amount) > 0 && Number(percent) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        phone,
        investedAmount: Number(amount),
        monthlyPercent: Number(percent),
        startedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
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
        aria-labelledby="coinvestor-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="coinvestor-title" className="font-semibold tracking-tight">
            Добавить соинвестора
          </h2>
          <p className="text-sm text-mute">Вложение в оборот и ставка ежемесячной выплаты</p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Имя</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Айгуль Сатыбалдиева" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Телефон <span className="text-xs text-mute">необязательно</span>
            </span>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 911 000-00-00" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Сумма вложения</span>
              <input
                inputMode="numeric"
                className={field}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="500 000"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">% в месяц</span>
              <input
                inputMode="decimal"
                className={field}
                value={percent}
                onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="3"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Дата вложения</span>
            <input type="date" className={field} value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
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
            Добавить
          </button>
        </footer>
      </form>
    </div>
  );
}

function PayoutModal({
  investor,
  suggested,
  onClose,
  onSubmit,
}: {
  investor: Coinvestor;
  suggested: number;
  onClose: () => void;
  onSubmit: (input: { amount: number; date: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(suggested));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось провести выплату");
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
        aria-labelledby="payout-title"
        className="relative w-full max-w-sm rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="payout-title" className="font-semibold tracking-tight">
            Выплата · {investor.name}
          </h2>
          <p className="text-sm text-mute">
            Спишется из кассы. Расчётное начисление за месяц — {money(suggested)}
          </p>
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
            Провести
          </button>
        </footer>
      </form>
    </div>
  );
}
