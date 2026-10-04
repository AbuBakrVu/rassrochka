"use client";

// Кабинет соинвестора по личной ссылке /investor/<токен>. Как и кабинет
// клиента, не пользуется общим стором: приходят только суммы самого
// соинвестора (lib/queries.ts, loadInvestorPortal), без клиентов и сделок.

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Repeat, SearchX, Wallet } from "lucide-react";
import { BrandMark, useBrandName } from "@/components/branding";
import MonthBars from "@/components/month-bars";
import { longDate, money } from "@/lib/schedule";
import { periodLabel } from "@/lib/coinvestor-accrual";

interface PortalData {
  name: string;
  accrualMode: "profit_share" | "fixed";
  profitSharePct: number;
  monthlyRatePct: number;
  startedAt: string;
  active: boolean;
  capital: number;
  accrued: number;
  paidOut: number;
  reinvested: number;
  owed: number;
  months: { month: string; amount: number }[];
  history: {
    id: string;
    date: string;
    kind: "deposit" | "withdrawal" | "reinvest" | "payout";
    amount: number;
    note?: string;
  }[];
}

const KIND: Record<PortalData["history"][number]["kind"], { label: string; icon: typeof Wallet; sign: string }> = {
  deposit: { label: "Пополнение капитала", icon: ArrowDownLeft, sign: "+" },
  withdrawal: { label: "Снятие капитала", icon: ArrowUpRight, sign: "−" },
  payout: { label: "Выплата прибыли", icon: Wallet, sign: "" },
  reinvest: { label: "Прибыль добавлена к капиталу", icon: Repeat, sign: "" },
};

// "2026-09" → «сен» / «сентябрь 2026»
const longMonth = (m: string) => periodLabel(`${m}-01`);
const shortMonth = (m: string) => longMonth(m).slice(0, 3);

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex max-w-sm flex-col items-center rounded-card border border-line bg-surface p-8 text-center shadow-card">
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[18px] bg-canvas px-4 py-3">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-0.5 font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-mute">{hint}</p>}
    </div>
  );
}

function View({ data }: { data: PortalData }) {
  const brandName = useBrandName();
  const terms =
    data.accrualMode === "fixed"
      ? `${data.monthlyRatePct}% в месяц на капитал — начисляется в конце каждого месяца`
      : `${data.profitSharePct}% от прибыли — начисляется с каждого оплаченного клиентом взноса`;
  const thisMonth = data.months[data.months.length - 1];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-2.5">
        <BrandMark className="h-10 w-10 rounded-[16px]" iconSize={17} />
        <div>
          <p className="text-sm font-semibold tracking-tight">{brandName}</p>
          <p className="text-xs text-mute">Кабинет соинвестора · {data.name}</p>
        </div>
      </header>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <p className="text-sm text-mute">Ваш капитал в обороте</p>
        <p className="mt-1 text-[32px] font-semibold tracking-tight">{money(data.capital)}</p>
        <p className="text-sm text-mute">с {longDate(new Date(`${data.startedAt}T00:00:00`))} г.</p>
        {!data.active && (
          <p className="mt-2 rounded-[12px] bg-warn-soft px-3 py-2 text-xs text-warn">
            Начисления приостановлены — уточните у компании.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="К выплате" value={money(data.owed)} />
          <Stat label="Начислено всего" value={money(data.accrued)} />
          <Stat label="Выплачено" value={money(data.paidOut)} />
          <Stat label="Реинвестировано" value={money(data.reinvested)} />
        </div>
        <p className="mt-3 text-xs text-mute">Условия: {terms}.</p>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">Начисления по месяцам</h2>
          {thisMonth && (
            <span className="text-xs text-mute">в этом месяце {money(thisMonth.amount)}</span>
          )}
        </div>
        <div className="mt-3">
          <MonthBars
            bars={data.months.map((m) => ({
              key: m.month,
              label: shortMonth(m.month),
              title: longMonth(m.month),
              value: m.amount,
            }))}
            format={money}
            ariaLabel="Начисления за последние 12 месяцев"
            emptyText="начислений пока нет"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <h2 className="px-5 pt-4 pb-2 font-semibold">Движение денег</h2>
        {data.history.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-mute">Операций пока не было.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.history.map((h) => {
              const k = KIND[h.kind];
              const Icon = k.icon;
              return (
                <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                    <Icon size={15} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{k.label}</p>
                    <p className="truncate text-xs text-mute">
                      {longDate(new Date(`${h.date}T00:00:00`))} г.{h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {k.sign}
                    {money(h.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-mute">
        Ссылка персональная — не передавайте её другим. Данные на {longDate(new Date())} г.
      </p>
    </div>
  );
}

export default function InvestorPortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/investor/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setState("missing");
        if (!res.ok) return setState("failed");
        setData(await res.json());
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <Centered>
        <div className="h-11 w-11 animate-pulse rounded-full bg-brand-soft" />
        <div className="mt-3 h-4 w-32 animate-pulse rounded bg-line" />
      </Centered>
    );
  }

  if (state !== "ready" || !data) {
    return (
      <Centered>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
          <SearchX size={20} aria-hidden />
        </span>
        <p className="font-medium">{state === "missing" ? "Ссылка недействительна" : "Не удалось загрузить"}</p>
        <p className="mt-1 text-sm text-mute">
          {state === "missing"
            ? "Уточните актуальную ссылку у компании."
            : "Проверьте соединение и обновите страницу."}
        </p>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <View data={data} />
    </div>
  );
}
