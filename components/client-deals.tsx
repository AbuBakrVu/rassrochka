"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui";
import type { DealState } from "@/lib/data";
import { money } from "@/lib/schedule";

export interface DealCardData {
  id: string;
  product: string;
  amount: number;
  months: number;
  state: DealState;
  status: string;
  statusTone: "blue" | "yellow" | "green" | "red" | "gray";
  paid: number;
  remaining: number;
  monthly: number;
  nextDate: string | null;
  openedLabel: string;
  nextStep: string;
  urgent?: boolean;
  manager: string;
}

// Порядок вкладок задан заказчиком
const tabs: { key: DealState | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "closed", label: "Закрытые" },
  { key: "rejected", label: "Отклонённые" },
  { key: "pending", label: "В ожидании" },
];

const emptyText: Record<DealState | "all", string> = {
  all: "У клиента пока нет сделок. Создайте первую — она появится здесь.",
  active: "Активных сделок нет. Клиент ничего не выплачивает прямо сейчас.",
  closed: "Закрытых сделок нет — ни одна рассрочка ещё не выплачена полностью.",
  rejected: "Отклонённых заявок нет. Все обращения дошли до сделки.",
  pending: "В работе ничего нет. Новые заявки появятся здесь до подписания.",
};

export default function ClientDeals({ deals }: { deals: DealCardData[] }) {
  const [tab, setTab] = useState<DealState | "all">("all");

  const count = (key: DealState | "all") =>
    key === "all" ? deals.length : deals.filter((d) => d.state === key).length;

  const list = tab === "all" ? deals : deals.filter((d) => d.state === tab);

  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <div className="px-5 pt-5 sm:px-6">
        <h2 className="font-semibold">Сделки клиента</h2>
        <p className="text-sm text-mute">
          Всего {deals.length} — переключайте вкладки, чтобы отобрать нужные
        </p>
      </div>

      {/* Вкладки */}
      <div
        className="mt-4 flex gap-1 overflow-x-auto border-b border-line px-5 sm:px-6"
        role="tablist"
        aria-label="Фильтр сделок по состоянию"
      >
        {tabs.map((t) => {
          const on = tab === t.key;
          const n = count(t.key);
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                on
                  ? "border-brand font-medium text-brand-deep"
                  : "border-transparent text-mute hover:text-ink"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  on ? "bg-brand-soft text-brand-deep" : "bg-canvas text-mute"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
            <FolderOpen size={20} aria-hidden />
          </span>
          <p className="font-medium">Здесь пусто</p>
          <p className="mt-1 max-w-xs text-sm text-mute">{emptyText[tab]}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 p-5 sm:p-6">
          {list.map((d) => (
            <li key={d.id}>
              <Link
                href={`/deals/${d.id}`}
                className="block rounded-[16px] border border-line p-4 transition-colors hover:border-brand hover:bg-canvas"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.product}</p>
                    <p className="text-sm text-mute">
                      {d.id} · {money(d.amount)} на {d.months} мес ·{" "}
                      {d.openedLabel}
                    </p>
                  </div>
                  <Badge tone={d.statusTone}>{d.status}</Badge>
                </div>

                {d.state === "active" && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="text-mute">
                        {d.paid} из {d.months} платежей
                      </span>
                      <span className="font-medium">
                        остаток {money(d.remaining)}
                      </span>
                    </div>
                    <div
                      className="flex gap-1"
                      role="progressbar"
                      aria-valuenow={d.paid}
                      aria-valuemin={0}
                      aria-valuemax={d.months}
                      aria-label={`Прогресс по сделке ${d.id}`}
                    >
                      {Array.from({ length: d.months }, (_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < d.paid ? "bg-brand" : "bg-line"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <p
                    className={`min-w-0 text-sm ${
                      d.urgent ? "font-medium text-danger" : "text-mute"
                    }`}
                  >
                    {d.state === "active" && d.nextDate
                      ? `Следующий платёж ${money(d.monthly)} — ${d.nextDate} г.`
                      : d.nextStep}
                  </p>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
                    Открыть <ArrowRight size={14} aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
