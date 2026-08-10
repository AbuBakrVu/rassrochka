"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, CircleDollarSign, Flag, Video, X, CalendarClock } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { money, longDate } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { computeCalendar, type CalendarCell } from "@/lib/derive";

const short = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n / 1000)) + " т.";

const kindIcon = {
  Звонок: Phone,
  Платёж: CircleDollarSign,
  Дедлайн: Flag,
  Созвон: Video,
} as const;

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function PaymentsPage() {
  const { deals, paidPayments } = useData();
  const shortToday = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  const data = useMemo(() => computeCalendar(deals, paidPayments), [deals, paidPayments]);
  const { cells: monthCells, todaySum, agenda, monthLabel, leadDays, todayDay, weekDayIsos } =
    data;

  const [view, setView] = useState<"month" | "week">("month");
  const [openDay, setOpenDay] = useState<CalendarCell | null>(null);

  const cells: (CalendarCell | null)[] = useMemo(() => {
    if (view === "week") {
      const byIso = new Map(monthCells.map((c) => [c.iso, c]));
      return weekDayIsos.map((iso) => byIso.get(iso) ?? null);
    }
    const padded: (CalendarCell | null)[] = [
      ...Array.from({ length: leadDays }, () => null),
      ...monthCells,
    ];
    while (padded.length % 7 !== 0) padded.push(null);
    return padded;
  }, [view, monthCells, weekDayIsos, leadDays]);

  return (
    <>
      <PageHeader
        title="Платежи"
        subtitle="План недели и месяца по всем сделкам"
        searchPlaceholder="Найти платёж или клиента"
        cta="+ Добавить"
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          {/* Календарь */}
          <Card className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{monthLabel}</h2>
                <p className="text-sm text-mute">
                  Платежи по активным сделкам — суммы обновляются сразу
                </p>
              </div>
              <select
                value={view}
                onChange={(e) => setView(e.target.value as "month" | "week")}
                aria-label="Период календаря"
                className="rounded-[10px] border border-line bg-surface px-4 py-2 text-sm text-mute outline-none hover:text-ink focus:border-brand"
              >
                <option value="month">Месяц</option>
                <option value="week">Неделя</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs text-mute">
                  {WEEKDAYS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={!c}
                      onClick={() => c && setOpenDay(c)}
                      className={`min-h-[86px] border-b border-line p-1.5 text-left ${
                        i % 7 !== 6 ? "border-r" : ""
                      } ${c ? "cursor-pointer transition-colors hover:bg-canvas" : "cursor-default bg-canvas/50"}`}
                    >
                      {c && (
                        <>
                          <p
                            className={`mb-1 px-1 text-sm ${
                              c.day === todayDay
                                ? "font-semibold text-brand-deep"
                                : "text-ink"
                            }`}
                          >
                            {c.day}
                            {c.day === todayDay && (
                              <span
                                className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle"
                                aria-hidden
                              />
                            )}
                          </p>
                          {c.payments && (
                            <span className="block truncate rounded-lg bg-brand-soft px-1.5 py-1 text-xs font-medium text-brand-deep">
                              {c.payments.count} опл. · {short(c.payments.sum)}
                            </span>
                          )}
                          {c.event && (
                            <span className="mt-1 block truncate rounded-lg bg-danger-soft px-1.5 py-1 text-xs font-medium text-danger">
                              {c.event.label}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Сегодня */}
          <Card className="h-fit p-5 sm:p-6">
            <h3 className="font-semibold">Сегодня · {shortToday}</h3>
            <p className="mt-1 text-sm text-mute">Сумма к получению</p>
            <p className="mt-1 text-[26px] font-semibold tracking-tight">
              {money(todaySum)}
            </p>
            {agenda.length === 0 ? (
              <p className="mt-4 text-sm text-mute">
                На сегодня дел не запланировано.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {agenda.map((it) => {
                  const Icon =
                    kindIcon[it.kind as keyof typeof kindIcon] ??
                    CircleDollarSign;
                  return (
                    <li key={it.dealId + it.kind}>
                      <Link
                        href={`/deals/${it.dealId}`}
                        className="-mx-2 flex gap-3 rounded-[10px] px-2 py-3 hover:bg-canvas"
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${
                            it.urgent
                              ? "bg-danger-soft text-danger"
                              : "bg-brand-soft text-brand"
                          }`}
                        >
                          <Icon size={15} aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-mute">
                            {it.time} · {it.kind}
                            {it.urgent && (
                              <span className="ml-1.5 font-medium text-danger">
                                срочно
                              </span>
                            )}
                          </p>
                          <p className="text-sm font-medium break-words">
                            {it.text}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {openDay && <DayModal cell={openDay} onClose={() => setOpenDay(null)} />}
    </>
  );
}

function DayModal({ cell, onClose }: { cell: CalendarCell; onClose: () => void }) {
  const date = longDate(new Date(`${cell.iso}T00:00:00`));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-modal-title"
        className="relative flex w-full max-w-md max-h-[80vh] flex-col overflow-hidden rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="day-modal-title" className="font-semibold tracking-tight">
            {date} г.
          </h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-[10px] p-2 text-mute hover:bg-canvas hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cell.event && (
            <div className="mb-3 flex items-center gap-3 rounded-[10px] bg-danger-soft px-3.5 py-2.5">
              <Flag size={15} className="shrink-0 text-danger" aria-hidden />
              <p className="text-sm font-medium text-danger">{cell.event.label}</p>
            </div>
          )}

          {cell.items.length === 0 && !cell.event ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CalendarClock size={22} className="mb-2 text-mute" aria-hidden />
              <p className="text-sm text-mute">На этот день ничего не запланировано.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {cell.items.map((it) => (
                <li key={it.dealId}>
                  <Link
                    href={`/deals/${it.dealId}`}
                    onClick={onClose}
                    className="-mx-1 flex items-center justify-between gap-3 rounded-[10px] px-1 py-3 hover:bg-canvas"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{it.clientName}</p>
                      <p className="truncate text-xs text-mute">
                        {it.product} · {it.dealId}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {money(it.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cell.payments && (
          <footer className="border-t border-line px-5 py-3 text-sm text-mute">
            Итого за день: {cell.payments.count} платежей на {money(cell.payments.sum)}
          </footer>
        )}
      </div>
    </div>
  );
}
