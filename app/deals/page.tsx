"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckSquare, Search, Square, X } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui";
import { stages, paidCount, type Deal, type DealStage } from "@/lib/data";
import { money } from "@/lib/schedule";
import { useData, type BulkResult } from "@/lib/store";
import SavedFilters from "@/components/saved-filters";

const KANBAN_STAGES = new Set<DealStage>(["new", "check", "active"]);

// Цвет точки в заголовке колонки — тот же, что у бейджа этапа
const STAGE_DOT: Partial<Record<DealStage, string>> = {
  new: "bg-chart-4",
  check: "bg-warn",
  active: "bg-good",
};

// Просрочки — наверх колонки: с них менеджер начинает день
const byUrgency = (a: Deal, b: Deal) =>
  Number(b.statusTone === "red") - Number(a.statusTone === "red") ||
  Number(!!b.urgent) - Number(!!a.urgent);

const months = (n: number) => {
  const last = n % 10;
  if (n >= 11 && n <= 14) return `${n} месяцев`;
  if (last === 1) return `${n} месяц`;
  if (last >= 2 && last <= 4) return `${n} месяца`;
  return `${n} месяцев`;
};

export default function DealsPage() {
  const { deals, employees, user, paidPayments, setDealStage, bulkUpdateDeals } = useData();
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

  const overdueCount = deals.filter(
    (d) => d.stage === "active" && d.statusTone === "red"
  ).length;

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
      <div className={`px-4 pt-4 pb-6 sm:px-8 ${selecting ? "pb-24" : ""}`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-auto">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-mute"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Клиент, товар или номер"
              aria-label="Поиск по сделкам"
              className="w-full rounded-full border border-line/70 bg-surface py-2.5 pr-4 pl-9 text-sm shadow-card outline-none focus:border-brand sm:w-64"
            />
          </label>
          <button
            onClick={() => setOverdueOnly((v) => !v)}
            aria-pressed={overdueOnly}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm shadow-card transition-colors ${
              overdueOnly
                ? "bg-danger font-medium text-white"
                : "border border-line/70 bg-surface text-mute hover:text-ink"
            }`}
          >
            <AlertTriangle size={15} aria-hidden />
            Только просрочки
            {overdueCount > 0 && (
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  overdueOnly ? "bg-white/25" : "bg-danger-soft text-danger"
                }`}
              >
                {overdueCount}
              </span>
            )}
          </button>
          <select
            value={managerId}
            onChange={(e) =>
              setManagerId(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            aria-label="Фильтр по менеджеру"
            className="rounded-full border border-line/70 bg-surface px-4 py-2.5 text-sm text-mute shadow-card hover:text-ink"
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
            className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm shadow-card transition-colors sm:ml-auto ${
              selecting
                ? "bg-brand font-medium text-on-brand"
                : "border border-line/70 bg-surface text-mute hover:text-ink"
            }`}
          >
            <CheckSquare size={15} aria-hidden />
            {selecting ? "Готово" : "Выбрать"}
          </button>
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
            className={`mb-4 flex items-start justify-between gap-3 rounded-[16px] border px-4 py-3 text-sm ${
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

        {/* На телефоне колонки листаются вбок по одной, на компьютере делят
            ширину поровну; у каждой своя прокрутка, чтобы длинная колонка
            «Активна» не растягивала страницу на несколько экранов */}
        <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:snap-none">
          <div className="flex gap-4">
            {stages.map((stage) => {
              const items = visibleDeals
                .filter((d) => d.stage === stage.key)
                .sort(byUrgency);
              const total = items.reduce((s, d) => s + d.amount, 0);
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
                  className={`flex w-[85vw] max-w-sm shrink-0 snap-start flex-col rounded-[22px] border p-2 transition-colors sm:w-80 lg:w-auto lg:max-w-none lg:min-w-72 lg:flex-1 ${
                    isDragOver
                      ? "border-brand bg-brand-soft"
                      : "border-line/60 bg-lane/70"
                  }`}
                  aria-label={`Этап «${stage.title}»`}
                >
                  <div className="flex items-center gap-2 px-2.5 pt-2 pb-3">
                    <span className={`h-2 w-2 rounded-full ${STAGE_DOT[stage.key] ?? "bg-mute"}`} aria-hidden />
                    <h3 className="text-sm font-semibold">{stage.title}</h3>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-mute">
                      {items.length}
                    </span>
                    <span className="ml-auto text-xs font-medium text-mute tabular-nums">
                      {money(total)}
                    </span>
                  </div>
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
                      className="mx-2.5 mb-2 self-start text-xs font-medium text-brand hover:text-brand-deep"
                    >
                      {items.every((d) => selected.has(d.id)) ? "Снять все" : "Выбрать все"}
                    </button>
                  )}
                  <div className="flex flex-col gap-2 overflow-y-auto p-0.5 lg:max-h-[calc(100dvh-15rem)]">
                    {items.length === 0 && (
                      <p className="rounded-[16px] border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
                        {draggingId ? "Перетащите сюда" : "Пусто"}
                      </p>
                    )}
                    {items.map((d) => {
                      const paid = paidCount(d, paidPayments);
                      const overdue = d.statusTone === "red";
                      return (
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
                          className={`relative block shrink-0 overflow-hidden rounded-[16px] border bg-surface p-3.5 shadow-card transition-shadow hover:shadow-pop ${
                            selecting
                              ? `cursor-pointer ${selected.has(d.id) ? "border-brand ring-2 ring-brand/30" : "border-line/70"}`
                              : "cursor-grab border-line/70 active:cursor-grabbing"
                          } ${moving === d.id ? "opacity-50" : ""} ${draggingId === d.id ? "opacity-40" : ""}`}
                        >
                          {overdue && (
                            <span className="absolute inset-y-0 left-0 w-1 bg-danger" aria-hidden />
                          )}
                          <div className="flex items-start gap-2.5">
                            {selecting &&
                              (selected.has(d.id) ? (
                                <CheckSquare size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                              ) : (
                                <Square size={16} className="mt-0.5 shrink-0 text-mute" aria-hidden />
                              ))}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{d.client}</p>
                              <p className="truncate text-xs text-mute">
                                {d.id} · {d.product}
                              </p>
                            </div>
                            <Badge tone={d.statusTone}>{d.status}</Badge>
                            {d.online && d.stage === "new" && <Badge tone="blue">С сайта</Badge>}
                          </div>

                          <div className="mt-3 flex items-baseline justify-between gap-2">
                            <span className="text-lg font-semibold tracking-tight tabular-nums">
                              {money(d.amount)}
                            </span>
                            <span className="text-xs text-mute">{months(d.months)}</span>
                          </div>

                          {d.stage === "active" && (
                            <div className="mt-2">
                              <div
                                className="flex gap-0.5"
                                role="img"
                                aria-label={`Оплачено ${paid} из ${d.months} платежей`}
                              >
                                {Array.from({ length: d.months }, (_, i) => (
                                  <span
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full ${
                                      i < paid ? "bg-brand" : i === paid && overdue ? "bg-danger" : "bg-line"
                                    }`}
                                  />
                                ))}
                              </div>
                              <p className="mt-1 text-xs text-mute">
                                {paid} из {d.months} платежей
                              </p>
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
                            <p
                              className={`min-w-0 flex-1 truncate text-sm ${
                                d.urgent ? "font-medium text-danger" : "text-mute"
                              }`}
                            >
                              {d.nextStep}
                            </p>
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-deep"
                              title={`Ответственный: ${employees.find((e) => e.id === d.managerId)?.name ?? d.manager}`}
                            >
                              {d.manager || "—"}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 py-3 shadow-pop sm:px-8 lg:left-[88px]">
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
              className="rounded-full border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50"
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
                className="rounded-full border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50"
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
              className="ml-auto rounded-full border border-line px-3.5 py-2 text-sm text-mute hover:text-ink"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </>
  );
}
