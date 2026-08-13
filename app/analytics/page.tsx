"use client";

import Link from "next/link";
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Receipt,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { stages, paidCount, dealMargin, type Deal } from "@/lib/data";
import { scheduleForDeal, money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { computeAging } from "@/lib/derive";

const decidedStages = ["active", "closed", "rejected"] as const;

function activeRemaining(deals: Deal[], paidPayments: Record<string, number>) {
  return deals
    .filter((d) => d.stage === "active")
    .reduce((sum, d) => {
      const schedule = scheduleForDeal(d, paidCount(d, paidPayments));
      const paidSum = schedule
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);
      return sum + (d.amount - paidSum);
    }, 0);
}

function Bar({
  label,
  value,
  max,
  tone = "brand",
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  tone?: "brand" | "danger" | "gray";
  suffix?: string;
}) {
  const pct = max ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  const bar =
    tone === "danger" ? "bg-danger" : tone === "gray" ? "bg-line" : "bg-brand";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { deals, paidPayments } = useData();
  const byStage = stages.map((s) => ({
    ...s,
    count: deals.filter((d) => d.stage === s.key).length,
  }));
  const maxStage = Math.max(...byStage.map((s) => s.count), 1);

  const closedDeals = deals.filter((d) => d.stage === "closed");
  const rejectedDeals = deals.filter((d) => d.stage === "rejected");
  const decided = deals.filter((d) =>
    decidedStages.includes(d.stage as (typeof decidedStages)[number])
  );
  const approvedCount = decided.length - rejectedDeals.length;
  const conversion = decided.length
    ? Math.round((approvedCount / decided.length) * 100)
    : 0;

  const avgDealSize = Math.round(
    deals.reduce((s, d) => s + d.amount, 0) / deals.length
  );

  const profit = deals
    .filter((d) => d.stage === "active" || d.stage === "closed")
    .reduce((s, d) => s + dealMargin(d.amount, d.markupPct, d.downPayment ?? 0), 0);

  const reasons = rejectedDeals.reduce<Record<string, number>>((acc, d) => {
    const reason = d.nextStep.replace(/^Отказ:\s*/, "");
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  const reasonList = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  const maxReason = Math.max(...reasonList.map(([, n]) => n), 1);

  const aging = computeAging(deals, paidPayments);
  const agingTotal = aging.reduce((s, b) => s + b.sum, 0);

  const managers = [...new Set(deals.map((d) => d.manager))].sort();
  const managerStats = managers.map((m) => {
    const list = deals.filter((d) => d.manager === m);
    return {
      manager: m,
      active: list.filter((d) => d.stage === "active").length,
      overdue: list.filter(
        (d) => d.stage === "active" && d.statusTone === "red"
      ).length,
      closed: list.filter((d) => d.stage === "closed").length,
      total: list.length,
    };
  });

  const kpis = [
    {
      label: "Портфель в работе",
      value: money(activeRemaining(deals, paidPayments)),
      note: "остаток по активным сделкам",
      icon: Wallet,
    },
    {
      label: "Одобрено",
      value: `${approvedCount} из ${decided.length}`,
      note: `конверсия ${conversion}%`,
      icon: CheckCircle2,
    },
    {
      label: "Отклонено",
      value: String(rejectedDeals.length),
      note: "заявок за всё время",
      icon: XCircle,
    },
    {
      label: "Средний чек",
      value: money(avgDealSize),
      note: `по ${deals.length} сделкам`,
      icon: Receipt,
    },
  ];

  return (
    <>
      <PageHeader
        title="Аналитика"
        subtitle="Воронка, отказы и нагрузка по сотрудникам"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(({ label, value, note, icon: Icon }) => (
            <Card key={label} className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-mute">{label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                  <Icon size={17} aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-semibold tracking-tight">
                {value}
              </p>
              <p className="mt-1 text-sm text-mute">{note}</p>
            </Card>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand" aria-hidden />
              <h2 className="font-semibold">Сделки по этапам</h2>
            </div>
            <p className="mb-4 text-sm text-mute">
              Сколько сделок сейчас находится на каждом шаге воронки
            </p>
            <div className="flex flex-col gap-4">
              {byStage.map((s) => (
                <Bar key={s.key} label={s.title} value={s.count} max={maxStage} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-line" aria-hidden />
                Закрыто успешно: <b className="font-semibold">{closedDeals.length}</b>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
                Отклонено: <b className="font-semibold">{rejectedDeals.length}</b>
              </span>
              <span className="text-mute">
                Прибыль по активным и закрытым: {money(profit)}
              </span>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2">
              <XCircle size={16} className="text-danger" aria-hidden />
              <h2 className="font-semibold">Причины отказов</h2>
            </div>
            <p className="mb-4 text-sm text-mute">
              По {rejectedDeals.length} отклонённым заявкам
            </p>
            {reasonList.length === 0 ? (
              <p className="text-sm text-mute">Отказов пока не было.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {reasonList.map(([reason, count]) => (
                  <Bar
                    key={reason}
                    label={reason}
                    value={count}
                    max={maxReason}
                    tone="danger"
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="mt-4 p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger" aria-hidden />
            <h2 className="font-semibold">Лестница просрочки</h2>
          </div>
          <p className="mb-4 text-sm text-mute">
            {agingTotal > 0
              ? `Просрочено ${money(agingTotal)} по активным сделкам`
              : "Просроченных платежей нет"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {aging.map((b) => {
              const tone =
                b.key === "1-7"
                  ? { bg: "bg-warn-soft", text: "text-warn" }
                  : { bg: "bg-danger-soft", text: "text-danger" };
              return (
                <div
                  key={b.key}
                  className="rounded-[12px] border border-line px-4 py-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.bg} ${tone.text}`}
                    >
                      {b.label}
                    </span>
                    <span className="text-sm font-semibold">
                      {b.items.length}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold tracking-tight">
                    {money(b.sum)}
                  </p>
                  {b.items.length === 0 ? (
                    <p className="mt-2 text-sm text-mute">Нет сделок</p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {b.items.map((i) => (
                        <Link
                          key={i.dealId}
                          href={`/deals/${i.dealId}`}
                          className="block rounded-[8px] px-1.5 py-1 text-sm transition-colors hover:bg-canvas"
                        >
                          <span className="block truncate text-ink">
                            {i.clientName}
                          </span>
                          <span className="text-mute">
                            {i.daysLate} дн · {money(i.amount)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
            <Users size={16} className="text-brand" aria-hidden />
            <h2 className="font-semibold">Нагрузка по сотрудникам</h2>
          </div>
          <p className="px-5 pb-4 text-sm text-mute sm:px-6">
            Кто сколько ведёт сделок прямо сейчас
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-mute">
                  <th className="px-5 py-2.5 font-medium sm:px-6">
                    Сотрудник
                  </th>
                  <th className="px-3 py-2.5 font-medium">Всего сделок</th>
                  <th className="px-3 py-2.5 font-medium">Активных</th>
                  <th className="px-3 py-2.5 font-medium">Просрочек</th>
                  <th className="px-3 py-2.5 font-medium">Закрыто</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {managerStats.map((m) => (
                  <tr key={m.manager}>
                    <td className="px-5 py-3 sm:px-6">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                        {m.manager}
                      </span>
                    </td>
                    <td className="px-3 py-3">{m.total}</td>
                    <td className="px-3 py-3">{m.active}</td>
                    <td className="px-3 py-3">
                      {m.overdue > 0 ? (
                        <span className="font-medium text-danger">
                          {m.overdue}
                        </span>
                      ) : (
                        <span className="text-mute">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{m.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
