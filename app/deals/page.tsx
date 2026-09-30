"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, Search, Square, X } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui";
import { stages, fmt, type DealStage } from "@/lib/data";
import { useData, type BulkResult } from "@/lib/store";
import SavedFilters from "@/components/saved-filters";

const KANBAN_STAGES = new Set<DealStage>(["new", "check", "active"]);

const months = (n: number) => {
  const last = n % 10;
  if (n >= 11 && n <= 14) return `${n} месяцев`;
  if (last === 1) return `${n} месяц`;
  if (last >= 2 && last <= 4) return `${n} месяца`;
  return `${n} месяцев`;
};

export default function DealsPage() {
  const { deals, employees, user, setDealStage, bulkUpdateDeals } = useData();
  const [managerId, setManagerId] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const q = query.trim().toLowerCase();
  const visibleDeals = deals.filter(
    (d) =>
      (managerId === "all" || d.managerId === managerId) &&
      (!overdueOnly || d.statusTone === "red") &&
      (q === "" ||
        d.client.toLowerCase().includes(q) ||
        d.product.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q))
  );

  const applyFilter = (p: Record<string, string>) => {
    setManagerId(p.manager ? Number(p.manager) : "all");
    setQuery(p.q ?? "");
    setOverdueOnly(p.overdue === "1");
  };

  // Режим массового выбора: клик по карточке выделяет её, а не открывает
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const runBulk = async (
    change: Parameters<typeof bulkUpdateDeals>[1]
  ) => {
    const ids = [...selected].filter((id) => visibleDeals.some((d) => d.id === id));
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const result = await bulkUpdateDeals(ids, change);
      setBulkResult(result);
      setSelected(new Set(result.failed.map((f) => f.id)));
      if (result.failed.length === 0) setSelecting(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось выполнить действие");
    } finally {
      setBulkBusy(false);
    }
  };

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
      <div className={`px-4 py-6 sm:px-8 ${selecting ? "pb-24" : ""}`}>
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
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Клиент, товар или номер"
                aria-label="Поиск по сделкам"
                className="w-56 rounded-[10px] border border-line bg-surface py-2 pr-3 pl-8 text-sm outline-none focus:border-brand"
              />
            </label>
            <button
              onClick={() => setOverdueOnly((v) => !v)}
              aria-pressed={overdueOnly}
              className={`rounded-[10px] px-3.5 py-2 text-sm transition-colors ${
                overdueOnly
                  ? "bg-danger font-medium text-white"
                  : "border border-line bg-surface text-mute hover:text-ink"
              }`}
            >
              Только просрочки
            </button>
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
            <button
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              aria-pressed={selecting}
              className={`flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm transition-colors ${
                selecting
                  ? "bg-brand font-medium text-on-brand"
                  : "border border-line bg-surface text-mute hover:text-ink"
              }`}
            >
              <CheckSquare size={15} aria-hidden />
              {selecting ? "Готово" : "Выбрать"}
            </button>
          </div>
        </div>

        <div className="mb-4 empty:hidden">
          <SavedFilters
            page="deals"
            current={{
              manager: managerId === "all" ? "" : String(managerId),
              q: query.trim(),
              overdue: overdueOnly ? "1" : "",
            }}
            onApply={applyFilter}
            canSave={managerId !== "all" || query.trim() !== "" || overdueOnly}
          />
        </div>

        {bulkResult && (
          <div
            role="status"
            className={`mb-4 flex items-start justify-between gap-3 rounded-[12px] border px-4 py-3 text-sm ${
              bulkResult.failed.length ? "border-warn/40 bg-warn-soft" : "border-good/30 bg-good-soft"
            }`}
          >
            <div>
              <p className="font-medium">
                Изменено сделок: {bulkResult.ok.length}
                {bulkResult.failed.length > 0 && ` · не удалось: ${bulkResult.failed.length}`}
              </p>
              {bulkResult.failed.map((f) => (
                <p key={f.id} className="text-mute">
                  {f.id} — {f.error}
                </p>
              ))}
            </div>
            <button
              onClick={() => setBulkResult(null)}
              aria-label="Скрыть"
              className="rounded-lg p-1 text-mute hover:text-ink"
            >
              <X size={15} aria-hidden />
            </button>
          </div>
        )}

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
                    isDragOver ? "bg-brand-soft ring-2 ring-brand" : "bg-lane"
                  }`}
                  aria-label={`Этап «${stage.title}»`}
                >
                  <div className="mb-3 flex items-center justify-between px-1.5 pt-1">
                    <h3 className="text-sm font-semibold">{stage.title}</h3>
                    <div className="flex items-center gap-2">
                      {selecting && items.length > 0 && (
                        <button
                          onClick={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              const all = items.every((d) => next.has(d.id));
                              for (const d of items) {
                                if (all) next.delete(d.id);
                                else next.add(d.id);
                              }
                              return next;
                            })
                          }
                          className="text-xs font-medium text-brand hover:text-brand-deep"
                        >
                          {items.every((d) => selected.has(d.id)) ? "Снять все" : "Выбрать все"}
                        </button>
                      )}
                      <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-mute">
                        {items.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map((d) => (
                      <Link
                        key={d.id}
                        href={`/deals/${d.id}`}
                        draggable={!selecting}
                        onClick={(e) => {
                          if (!selecting) return;
                          e.preventDefault();
                          toggleSelected(d.id);
                        }}
                        aria-pressed={selecting ? selected.has(d.id) : undefined}
                        onDragStart={(e) => {
                          setDraggingId(d.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", d.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverStage(null);
                        }}
                        className={`block rounded-[12px] border bg-surface p-4 shadow-card transition-shadow hover:shadow-pop ${
                          selecting
                            ? `cursor-pointer ${selected.has(d.id) ? "border-brand ring-2 ring-brand/30" : "border-line"}`
                            : "cursor-grab border-line active:cursor-grabbing"
                        } ${moving === d.id ? "opacity-50" : ""} ${draggingId === d.id ? "opacity-40" : ""}`}
                      >
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            {selecting &&
                              (selected.has(d.id) ? (
                                <CheckSquare size={16} className="text-brand" aria-hidden />
                              ) : (
                                <Square size={16} className="text-mute" aria-hidden />
                              ))}
                            <Badge tone={d.statusTone}>{d.status}</Badge>
                          </span>
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

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur sm:px-8 lg:left-60">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium">
              Выбрано: {[...selected].filter((id) => visibleDeals.some((d) => d.id === id)).length}
            </p>
            <select
              value=""
              disabled={selected.size === 0 || bulkBusy}
              onChange={(e) => {
                const stage = e.target.value as "new" | "check" | "active";
                if (stage) runBulk({ action: "stage", stage });
              }}
              aria-label="Перенести выбранные в этап"
              className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">Перенести в этап…</option>
              {stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                </option>
              ))}
            </select>
            {user.role === "admin" && (
              <select
                value=""
                disabled={selected.size === 0 || bulkBusy}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) runBulk({ action: "manager", managerId: id });
                }}
                aria-label="Назначить ответственного выбранным"
                className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Назначить ответственного…</option>
                {employees
                  .filter((e) => e.active)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            )}
            {bulkBusy && <span className="text-sm text-mute">Применяем…</span>}
            <button
              onClick={stopSelecting}
              className="ml-auto rounded-[10px] border border-line px-3.5 py-2 text-sm text-mute hover:text-ink"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </>
  );
}
