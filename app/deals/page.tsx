"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui";
import { stages, fmt, type DealStage } from "@/lib/data";
import { useData } from "@/lib/store";

const KANBAN_STAGES = new Set<DealStage>(["new", "check", "active"]);

const months = (n: number) => {
  const last = n % 10;
  if (n >= 11 && n <= 14) return `${n} месяцев`;
  if (last === 1) return `${n} месяц`;
  if (last >= 2 && last <= 4) return `${n} месяца`;
  return `${n} месяцев`;
};

export default function DealsPage() {
  const { deals, employees, setDealStage } = useData();
  const [managerId, setManagerId] = useState<number | "all">("all");
  const visibleDeals =
    managerId === "all" ? deals : deals.filter((d) => d.managerId === managerId);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const drop = async (stage: DealStage, e: React.DragEvent) => {
    setDragOverStage(null);
    setDraggingId(null);
    // Из dataTransfer, а не из React-состояния: состояние из dragstart может
    // не успеть примениться к моменту drop (оба — часть одного жеста, но
    // разные события), а dataTransfer для этого и придуман в HTML5 DnD.
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const deal = visibleDeals.find((d) => d.id === id);
    if (!deal || deal.stage === stage || !KANBAN_STAGES.has(deal.stage)) return;

    setMoving(id);
    try {
      await setDealStage(id, stage as "new" | "check" | "active");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось перенести сделку");
    } finally {
      setMoving(null);
    }
  };

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
          <select
            value={managerId}
            onChange={(e) =>
              setManagerId(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            aria-label="Фильтр по менеджеру"
            className="rounded-[10px] border border-line bg-surface px-4 py-2 text-sm text-mute hover:text-ink"
          >
            <option value="all">Все менеджеры</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
          <div className="flex min-w-max gap-4">
            {stages.map((stage) => {
              const items = visibleDeals.filter((d) => d.stage === stage.key);
              const isDragOver = dragOverStage === stage.key;
              return (
                <section
                  key={stage.key}
                  onDragOver={(e) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    if (dragOverStage !== stage.key) setDragOverStage(stage.key);
                  }}
                  onDragLeave={() =>
                    setDragOverStage((s) => (s === stage.key ? null : s))
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(stage.key, e);
                  }}
                  className={`w-72 shrink-0 rounded-card p-3 transition-colors ${
                    isDragOver ? "bg-brand-soft ring-2 ring-brand" : "bg-[#eef3fa]"
                  }`}
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
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(d.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", d.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverStage(null);
                        }}
                        className={`block cursor-grab rounded-[12px] border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-pop active:cursor-grabbing ${
                          moving === d.id ? "opacity-50" : ""
                        } ${draggingId === d.id ? "opacity-40" : ""}`}
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
