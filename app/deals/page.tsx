"use client";

import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui";
import { stages, fmt } from "@/lib/data";
import { useData } from "@/lib/store";

const months = (n: number) => {
  const last = n % 10;
  if (n >= 11 && n <= 14) return `${n} месяцев`;
  if (last === 1) return `${n} месяц`;
  if (last >= 2 && last <= 4) return `${n} месяца`;
  return `${n} месяцев`;
};

export default function DealsPage() {
  const { deals } = useData();
  return (
    <>
      <PageHeader
        title="Сделки"
        subtitle="Ведите клиента по этапам без потери контекста"
        searchPlaceholder="Поиск по сделкам"
        cta="+ Добавить"
      />
      <div className="px-4 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Клиентский поток
            </h2>
            <p className="mt-1 text-sm text-mute">
              Каждая карточка показывает сумму, срок и следующий ответственный
              шаг.
            </p>
          </div>
          <button className="rounded-[10px] border border-line bg-surface px-4 py-2 text-sm text-mute hover:text-ink">
            Все менеджеры ▾
          </button>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
          <div className="flex min-w-max gap-4">
            {stages.map((stage) => {
              const items = deals.filter((d) => d.stage === stage.key);
              return (
                <section
                  key={stage.key}
                  className="w-72 shrink-0 rounded-card bg-[#eef3fa] p-3"
                  aria-label={`Этап «${stage.title}»`}
                >
                  <div className="mb-3 flex items-center justify-between px-1.5 pt-1">
                    <h3 className="text-sm font-semibold">{stage.title}</h3>
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-mute">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map((d) => (
                      <Link
                        key={d.id}
                        href={`/deals/${d.id}`}
                        className="block rounded-[12px] border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-pop"
                      >
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <Badge tone={d.statusTone}>{d.status}</Badge>
                          <span className="text-xs text-mute">{d.id}</span>
                        </div>
                        <p className="font-medium">{d.client}</p>
                        <p className="mt-1 text-sm text-mute">
                          {fmt(d.amount)} · {months(d.months)}
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                          <p
                            className={`text-sm ${
                              d.urgent
                                ? "font-medium text-danger"
                                : "text-mute"
                            }`}
                          >
                            {d.nextStep}
                          </p>
                          <span
                            className="shrink-0 text-xs font-semibold text-brand"
                            title="Ответственный менеджер"
                          >
                            {d.manager}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
