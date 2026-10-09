"use client";

// «Лестница просрочки»: активные просроченные сделки по корзинам 1–7 / 8–30 /
// 30+ дней со ссылками на сделки. Живёт в Аналитике → Качество портфеля,
// рядом с остальными цифрами о просрочке.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { computeAging } from "@/lib/derive";

export default function AgingLadder() {
  const { deals, paidPayments } = useData();
  const aging = computeAging(deals, paidPayments);
  const agingTotal = aging.reduce((s, b) => s + b.sum, 0);

  return (
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
                  className="rounded-[16px] border border-line px-4 py-3.5"
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
                          className="block rounded-[10px] px-1.5 py-1 text-sm transition-colors hover:bg-canvas"
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
  );
}
