"use client";

import Link from "next/link";
import { Phone, CircleDollarSign, Flag, Video } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { computeCalendar } from "@/lib/derive";

const short = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n / 1000)) + " т.";

const kindIcon = {
  Звонок: Phone,
  Платёж: CircleDollarSign,
  Дедлайн: Flag,
  Созвон: Video,
} as const;

export default function PaymentsPage() {
  const { deals, paidPayments } = useData();
  const shortToday = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  const { cells: monthCells, todaySum, agenda } = computeCalendar(
    deals,
    paidPayments
  );

  // Август 2026 начинается с субботы → 5 пустых ячеек (Пн–Пт)
  const lead = 5;
  const cells: (typeof monthCells[number] | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...monthCells,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

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
                <h2 className="text-lg font-semibold tracking-tight">
                  Август 2026
                </h2>
                <p className="text-sm text-mute">
                  Платежи по активным сделкам — суммы обновляются сразу
                </p>
              </div>
              <button className="rounded-[10px] border border-line bg-surface px-4 py-2 text-sm text-mute hover:text-ink">
                Месяц ▾
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs text-mute">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((c, i) => (
                    <div
                      key={i}
                      className={`min-h-[86px] border-b border-line p-1.5 ${
                        i % 7 !== 6 ? "border-r" : ""
                      } ${c ? "" : "bg-canvas/50"}`}
                    >
                      {c && (
                        <>
                          <p
                            className={`mb-1 px-1 text-sm ${
                              c.day === 5
                                ? "font-semibold text-brand-deep"
                                : "text-ink"
                            }`}
                          >
                            {c.day}
                            {c.day === 5 && (
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
                    </div>
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
    </>
  );
}
