"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Handshake,
  Wallet,
  TrendingUp,
  Percent,
  Users,
  Search,
  Info,
  ChevronRight,
} from "lucide-react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { money } from "@/lib/schedule";
import { todayIso } from "@/lib/derive";
import { useData, type Coinvestor } from "@/lib/store";

const field =
  "w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

export default function CoinvestorsPage() {
  const { coinvestors, cash, user, addCoinvestor } = useData();
  const isAdmin = user.role === "admin";
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  // «Прибыль кассы» — реальные деньги, которые касса заработала: платежи
  // клиентов минус закупочная стоимость товара. Ровно от этой суммы
  // считается доля каждого соинвестора (см. lib/queries.accrueCoinvestorProfit).
  const profit = useMemo(() => {
    const monthPrefix = todayIso().slice(0, 7);
    let total = 0;
    let month = 0;
    for (const t of cash) {
      if (t.kind !== "payment" && t.kind !== "purchase") continue;
      total += t.amount;
      if (t.date.startsWith(monthPrefix)) month += t.amount;
    }
    return { total, month };
  }, [cash]);

  const totals = useMemo(
    () => ({
      capital: coinvestors.reduce((s, c) => s + c.capital, 0),
      accrued: coinvestors.reduce((s, c) => s + c.accrued, 0),
      owed: coinvestors.reduce((s, c) => s + c.owed, 0),
      active: coinvestors.filter((c) => c.active).length,
    }),
    [coinvestors]
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return coinvestors
      .filter((c) => !onlyActive || c.active)
      .filter(
        (c) =>
          q === "" ||
          c.name.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
      );
  }, [coinvestors, query, onlyActive]);

  return (
    <>
      <PageHeader
        title="Соинвесторы"
        subtitle="Капитал партнёров и доля от реальной прибыли кассы"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={Wallet} label="Капитал под управлением" value={money(totals.capital)} note={`${coinvestors.length} ${ruPlural(coinvestors.length)}`} />
          <Kpi
            icon={TrendingUp}
            label="Прибыль кассы за месяц"
            value={`${profit.month >= 0 ? "" : "−"}${money(Math.abs(profit.month))}`}
            note={`за всё время ${profit.total >= 0 ? "" : "−"}${money(Math.abs(profit.total))}`}
            tone={profit.month >= 0 ? "good" : "warn"}
          />
          <Kpi icon={Percent} label="Начислено соинвесторам" value={money(totals.accrued)} note="за всё время" />
          <Kpi icon={Users} label="К выплате" value={money(totals.owed)} note={`${totals.active} активных`} tone={totals.owed > 0 ? "warn" : undefined} />
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-card border border-brand-soft bg-brand-soft/40 px-4 py-3.5 text-sm">
          <Info size={17} className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <p className="text-brand-deep">
            Доля считается автоматически: с каждого принятого платежа клиента
            в кассу попадает часть маржи сделки, и активные соинвесторы сразу
            получают начисление — свой процент от этой суммы. Ничего не нужно
            считать вручную.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени или телефону"
              className="w-full rounded-[14px] border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-brand"
            />
          </label>
          <button
            onClick={() => setOnlyActive((v) => !v)}
            aria-pressed={onlyActive}
            className={`rounded-full px-3.5 py-2 text-sm transition-colors ${
              onlyActive
                ? "bg-brand font-medium text-on-brand"
                : "border border-line bg-surface text-mute hover:text-ink"
            }`}
          >
            Только активные
          </button>
          {isAdmin && (
            <button
              onClick={() => setAddOpen(true)}
              className="ml-auto rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
            >
              + Добавить соинвестора
            </button>
          )}
        </div>

        <Card className="mt-4 overflow-hidden">
          {list.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title={coinvestors.length === 0 ? "Соинвесторов пока нет" : "Никого не нашли"}
              text={
                coinvestors.length === 0
                  ? "Добавьте первого, чтобы вести учёт капитала и начислений."
                  : "Проверьте написание или сбросьте фильтр «Только активные»."
              }
              {...(isAdmin && coinvestors.length === 0
                ? { action: "Добавить соинвестора", onAction: () => setAddOpen(true) }
                : {})}
            />
          ) : (
            <CoinvestorTable rows={list} />
          )}
        </Card>
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
    </>
  );
}

function ruPlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "соинвестор";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "соинвестора";
  return "соинвесторов";
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  note: string;
  tone?: "good" | "warn";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-mute">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
          <Icon size={17} aria-hidden />
        </span>
      </div>
      <p
        className={`mt-2 text-[26px] font-semibold tracking-tight ${
          tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-mute">{note}</p>
    </Card>
  );
}

function CoinvestorTable({ rows }: { rows: Coinvestor[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-mute">
            <th className="px-5 py-3 font-medium">Соинвестор</th>
            <th className="px-5 py-3 font-medium">Капитал</th>
            <th className="px-5 py-3 font-medium">Доля прибыли</th>
            <th className="px-5 py-3 font-medium">Начислено</th>
            <th className="px-5 py-3 font-medium">К выплате</th>
            <th className="px-5 py-3 font-medium">Статус</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((c) => (
            <tr
              key={c.id}
              onClick={() => router.push(`/coinvestors/${c.id}`)}
              className="cursor-pointer transition-colors hover:bg-canvas"
            >
              <td className="px-5 py-3.5">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-mute">{c.phone}</p>
              </td>
              <td className="px-5 py-3.5">{money(c.capital)}</td>
              <td className="px-5 py-3.5">{c.profitSharePct}%</td>
              <td className="px-5 py-3.5">{money(c.accrued)}</td>
              <td className="px-5 py-3.5 font-medium">
                {c.owed > 0 ? money(c.owed) : "—"}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={c.active ? "green" : "gray"}>
                  {c.active ? "Активен" : "Приостановлен"}
                </Badge>
              </td>
              <td className="px-4 py-3.5 text-right text-mute">
                <ChevronRight size={16} aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    profitSharePct: number;
    startedAt: string;
    openingCapital?: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [percent, setPercent] = useState("");
  const [openingCapital, setOpeningCapital] = useState("");
  const [startedAt, setStartedAt] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "" && Number(percent) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        phone,
        profitSharePct: Number(percent),
        startedAt,
        ...(Number(openingCapital) > 0 ? { openingCapital: Number(openingCapital) } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-scrim" onClick={onClose} />
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
          <p className="text-sm text-mute">Доля — процент от реальной прибыли кассы</p>
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
              <span className="mb-1.5 block text-sm font-medium">Доля прибыли, %</span>
              <input
                inputMode="decimal"
                className={field}
                value={percent}
                onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="10"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Дата вложения</span>
              <input type="date" className={field} value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Стартовый капитал <span className="text-xs text-mute">необязательно</span>
            </span>
            <div className="relative">
              <input
                inputMode="numeric"
                className={`${field} pr-9`}
                value={openingCapital}
                onChange={(e) => setOpeningCapital(e.target.value.replace(/\D/g, ""))}
                placeholder="500 000"
              />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">₽</span>
            </div>
            <p className="mt-1.5 text-xs text-mute">
              Если указать, сразу попадёт в кассу как пополнение капитала.
            </p>
          </label>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Сохраняем…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Добавить
          </button>
        </footer>
      </form>
    </div>
  );
}
