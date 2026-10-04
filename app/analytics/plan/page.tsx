"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, MapPin, Pencil, Target, Users } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import AnalyticsTabs from "@/components/analytics-tabs";
import { useData } from "@/lib/store";
import { completion, computePlanFact, type PlanFactRow } from "@/lib/collection-plan";
import { periodLabel } from "@/lib/coinvestor-accrual";
import { money } from "@/lib/schedule";
import { todayIso } from "@/lib/status";

function shiftMonth(month: string, n: number): string {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pctTone(p: number | null) {
  if (p === null) return "text-mute";
  if (p >= 100) return "text-good";
  if (p >= 80) return "text-warn";
  return "text-danger";
}

/** Накопленный план и факт по дням месяца: где мы относительно графика. */
function PaceChart({ daily, today }: { daily: { day: number; plan: number; fact: number }[]; today: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 720;
  const h = 220;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const max = Math.max(...daily.map((d) => Math.max(d.plan, d.fact)), 1);
  const x = (day: number) => padL + ((day - 1) / Math.max(daily.length - 1, 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  // Факт рисуем до сегодняшнего дня — дальше его ещё нет
  const factDays = today === null ? daily : daily.filter((d) => d.day <= today);
  const line = (pts: { day: number; v: number }[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const hovered = hover !== null ? daily[hover - 1] : null;

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-mute">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-brand" aria-hidden /> Собрано
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-mute" aria-hidden /> План по графикам
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-52 w-full"
        role="img"
        aria-label="Накопленный план и факт сборов по дням месяца"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * w;
          const day = Math.round(((rel - padL) / (w - padL - padR)) * (daily.length - 1)) + 1;
          setHover(Math.min(Math.max(day, 1), daily.length));
        }}
      >
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={padL} x2={w - padR} y1={y(max * t)} y2={y(max * t)} stroke="var(--color-line)" />
        ))}
        <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
        {[1, 10, 20, daily.length].map((d) => (
          <text key={d} x={x(d)} y={h - 6} textAnchor="middle" fontSize="11" fill="var(--color-mute)">
            {d}
          </text>
        ))}
        <path
          d={line(daily.map((d) => ({ day: d.day, v: d.plan })))}
          fill="none"
          stroke="var(--color-mute)"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <path
          d={line(factDays.map((d) => ({ day: d.day, v: d.fact })))}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {hovered && (
          <>
            <line x1={x(hovered.day)} x2={x(hovered.day)} y1={padT} y2={y(0)} stroke="var(--color-mute)" strokeOpacity="0.4" />
            <circle cx={x(hovered.day)} cy={y(hovered.plan)} r="4" fill="var(--color-mute)" stroke="var(--color-surface)" strokeWidth="2" />
            {(today === null || hovered.day <= today) && (
              <circle cx={x(hovered.day)} cy={y(hovered.fact)} r="4" fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth="2" />
            )}
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-6 rounded-[12px] bg-surface px-3 py-2 text-xs shadow-pop"
          style={{ left: `clamp(0px, calc(${(x(hovered.day) / w) * 100}% - 70px), calc(100% - 150px))` }}
        >
          <p className="font-medium">{hovered.day}-е число</p>
          <p className="text-mute">План: {money(hovered.plan)}</p>
          {(today === null || hovered.day <= today) && <p>Собрано: {money(hovered.fact)}</p>}
        </div>
      )}
    </div>
  );
}

function PlanTable({
  icon: Icon,
  title,
  text,
  rows,
  first,
  onEditTarget,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  rows: PlanFactRow[];
  first: string;
  onEditTarget?: (row: PlanFactRow) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
        <Icon size={16} className="text-brand" aria-hidden />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="px-5 pb-4 text-sm text-mute sm:px-6">{text}</p>
      {rows.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-mute sm:px-6">В этом месяце взносов по графикам нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-mute">
                <th className="px-5 py-2.5 font-medium sm:px-6">{first}</th>
                <th className="px-3 py-2.5 text-right font-medium">План</th>
                <th className="px-3 py-2.5 text-right font-medium">Собрано</th>
                <th className="px-3 py-2.5 font-medium">Выполнение</th>
                <th className="px-3 py-2.5 text-right font-medium">По плану месяца</th>
                <th className="px-3 py-2.5 text-right font-medium">Просрочка прошлых</th>
                <th className="px-3 py-2.5 pr-5 text-right font-medium sm:pr-6">Вперёд</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const p = completion(r);
                return (
                  <tr key={r.key}>
                    <td className="px-5 py-3 sm:px-6">
                      <p className="font-medium">{r.label}</p>
                      <p className="text-xs text-mute">{r.deals} сд. со взносом в месяце</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {money(r.plan)}
                        {onEditTarget && r.key !== "none" && (
                          <button
                            type="button"
                            onClick={() => onEditTarget(r)}
                            aria-label={`Изменить план для ${r.label}`}
                            className="rounded-full p-1 text-mute hover:bg-canvas hover:text-ink"
                          >
                            <Pencil size={12} aria-hidden />
                          </button>
                        )}
                      </span>
                      <p className="text-xs text-mute">
                        {r.target !== undefined ? `цель · по графикам ${money(r.auto)}` : "по графикам"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{money(r.fact)}</td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-28 items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line" aria-hidden>
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${Math.min(p ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className={`font-medium tabular-nums ${pctTone(p)}`}>{p === null ? "—" : `${p}%`}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(r.onPlan)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.arrears ? money(r.arrears) : <span className="text-mute">—</span>}
                    </td>
                    <td className="px-3 py-3 pr-5 text-right tabular-nums sm:pr-6">
                      {r.ahead ? money(r.ahead) : <span className="text-mute">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function PlanFactPage() {
  const { deals, cash, employees, branches, multiBranch, user, setCollectionTarget } = useData();
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [targets, setTargets] = useState<Map<number, number>>(new Map());
  const [reload, setReload] = useState(0);
  const isAdmin = user.role === "admin";

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/collection-plan/targets?month=${month}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { managerId: number; amount: number }[]) => {
        if (!cancelled) setTargets(new Map(rows.map((r) => [r.managerId, r.amount])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [month, reload]);

  const pf = useMemo(
    () => computePlanFact({ month, deals, cash, managers: employees, branches, targets }),
    [month, deals, cash, employees, branches, targets]
  );
  const t = pf.total;
  const p = completion(t);
  const isCurrent = month === today.slice(0, 7);
  const isFuture = month > today.slice(0, 7);
  const dayToday = isCurrent ? Number(today.slice(8, 10)) : isFuture ? 0 : null;
  const planToDate = dayToday === null ? t.auto : dayToday === 0 ? 0 : pf.daily[dayToday - 1].plan;
  const factToDate = dayToday === null ? t.fact : dayToday === 0 ? 0 : pf.daily[dayToday - 1].fact;

  const editTarget = async (row: PlanFactRow) => {
    const input = prompt(
      `План сборов на ${periodLabel(`${month}-01`)} для ${row.label}, ₽.\nПусто — считать по графикам (${money(row.auto)}).`,
      row.target !== undefined ? String(row.target) : ""
    );
    if (input === null) return;
    const clean = input.replace(/\s/g, "");
    const amount = clean === "" ? null : Number(clean);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      alert("Введите сумму от 0");
      return;
    }
    try {
      await setCollectionTarget(month, Number(row.key), amount);
      setReload((n) => n + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  };

  const kpis = [
    { label: "План на месяц", value: money(t.plan), note: t.plan !== t.auto ? `по графикам ${money(t.auto)}` : "взносы графиков в этом месяце", cls: "" },
    { label: "Собрано", value: money(t.fact), note: p === null ? "плана нет" : `${p}% плана`, cls: pctTone(p) },
    {
      label: isCurrent ? "К сегодняшнему дню" : "Осталось собрать",
      value: isCurrent ? `${money(factToDate)} из ${money(planToDate)}` : money(Math.max(t.plan - t.fact, 0)),
      note: isCurrent
        ? planToDate === 0 && factToDate === 0
          ? "по графикам пока ничего не ожидалось"
          : factToDate >= planToDate
          ? "идём по графику или быстрее"
          : `отстаём на ${money(planToDate - factToDate)}`
        : "до выполнения плана",
      cls: "",
    },
    {
      label: "Не собрано из плана месяца",
      value: money(Math.max(t.auto - t.onPlan, 0)),
      note: "взносы этого месяца, по которым денег ещё нет",
      cls: t.auto - t.onPlan > 0 && !isFuture ? "text-danger" : "",
    },
  ];

  return (
    <>
      <PageHeader title="Аналитика" subtitle="План и факт сборов за месяц" />
      <AnalyticsTabs />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Предыдущий месяц"
            className="rounded-full border border-line bg-surface p-2 text-mute hover:text-ink"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <p className="min-w-40 text-center font-semibold capitalize">{periodLabel(`${month}-01`)}</p>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Следующий месяц"
            className="rounded-full border border-line bg-surface p-2 text-mute hover:text-ink"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => setMonth(today.slice(0, 7))}
              className="ml-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-mute hover:text-ink"
            >
              Текущий месяц
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5">
              <p className="text-sm text-mute">{k.label}</p>
              <p className={`mt-2 text-[22px] font-semibold tracking-tight ${k.cls}`}>{k.value}</p>
              <p className="mt-1 text-sm text-mute">{k.note}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <Target size={16} className="text-brand" aria-hidden />
            <h2 className="font-semibold">Темп сборов</h2>
          </div>
          <p className="mb-3 text-sm text-mute">
            Накопленным итогом по дням: сколько должно было прийти по графикам и сколько пришло.
          </p>
          <PaceChart daily={pf.daily} today={dayToday} />
        </Card>

        <div className="mt-4 flex flex-col gap-4">
          <PlanTable
            icon={Users}
            title="По менеджерам"
            text={
              isAdmin
                ? "План менеджера — его взносы по графикам; карандашом можно поставить свою цель"
                : "План менеджера — взносы по графикам его сделок или цель от администратора"
            }
            rows={pf.byManager}
            first="Менеджер"
            {...(isAdmin ? { onEditTarget: editTarget } : {})}
          />
          {multiBranch && (
            <PlanTable
              icon={MapPin}
              title="По филиалам"
              text="План филиала — взносы по графикам его сделок"
              rows={pf.byBranch}
              first="Филиал"
            />
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-mute">
          <Info size={13} className="mt-px shrink-0" aria-hidden />
          Собрано — платежи клиентов по кассе за месяц, включая частичные и досрочное
          погашение, за вычетом отмен; первоначальные взносы не входят. «Просрочка
          прошлых» — деньги за взносы прошлых месяцев, «вперёд» — за следующие.
        </p>
      </div>
    </>
  );
}
