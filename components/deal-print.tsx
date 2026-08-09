"use client";

import type { Deal, Client } from "@/lib/data";
import { fmt } from "@/lib/data";
import { money, type Installment } from "@/lib/schedule";

// Печатная версия карточки сделки — рендерится в портал поверх всего
// приложения (см. вызов в deal-detail.tsx) и видна только в @media print,
// пока обычный интерфейс (components/shell.tsx) на печати скрыт целиком.

export type PrintMode = "contract" | "summary";

export default function DealPrint({
  mode,
  deal,
  client,
  schedule,
  paid,
  monthly,
  paidSum,
  remaining,
}: {
  mode: PrintMode;
  deal: Deal;
  client?: Client;
  schedule: Installment[];
  paid: number;
  monthly: number;
  paidSum: number;
  remaining: number;
}) {
  const lastPaid = paid > 0 ? schedule[paid - 1] : undefined;

  return (
    <div className="hidden bg-white p-10 text-black print:block">
      <div className="flex items-center justify-between border-b border-black/20 pb-4">
        <div>
          <p className="text-lg font-semibold">Nasiya</p>
          <p className="text-sm text-black/60">Учёт рассрочек</p>
        </div>
        <div className="text-right text-sm text-black/60">
          <p>
            {mode === "contract" ? "Договор рассрочки" : "Сводка по сделке"}
          </p>
          <p>№ {deal.id}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-black/50">Клиент</p>
          <p className="font-medium">{deal.client}</p>
          {client?.phone && <p>{client.phone}</p>}
        </div>
        <div>
          <p className="text-black/50">Товар</p>
          <p className="font-medium">{deal.product}</p>
        </div>
        <div>
          <p className="text-black/50">Сумма рассрочки</p>
          <p className="font-medium">{fmt(deal.amount)}</p>
        </div>
        <div>
          <p className="text-black/50">Срок</p>
          <p className="font-medium">{deal.months} месяцев, ежемесячно</p>
        </div>
        <div>
          <p className="text-black/50">Ежемесячный платёж</p>
          <p className="font-medium">{money(monthly)}</p>
        </div>
        <div>
          <p className="text-black/50">Ответственный</p>
          <p className="font-medium">{deal.manager}</p>
        </div>
      </div>

      {mode === "summary" && (
        <div className="mt-6 grid grid-cols-3 gap-6 border-t border-black/20 pt-4 text-sm">
          <div>
            <p className="text-black/50">Оплачено</p>
            <p className="font-medium">{money(paidSum)}</p>
          </div>
          <div>
            <p className="text-black/50">Остаток</p>
            <p className="font-medium">{money(remaining)}</p>
          </div>
          <div>
            <p className="text-black/50">Платежей внесено</p>
            <p className="font-medium">
              {paid} из {deal.months}
            </p>
          </div>
        </div>
      )}

      {mode === "summary" && lastPaid && (
        <div className="mt-6 rounded border border-black/20 p-4 text-sm">
          <p className="font-medium">Квитанция о последнем платеже</p>
          <div className="mt-2 grid grid-cols-3 gap-4">
            <div>
              <p className="text-black/50">Платёж №</p>
              <p>
                {lastPaid.n} из {deal.months}
              </p>
            </div>
            <div>
              <p className="text-black/50">Дата</p>
              <p>{lastPaid.date} г.</p>
            </div>
            <div>
              <p className="text-black/50">Сумма</p>
              <p>{money(lastPaid.amount)}</p>
            </div>
          </div>
        </div>
      )}

      {mode === "contract" && (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/30 text-left">
              <th className="py-1.5 pr-2 font-medium">№</th>
              <th className="py-1.5 pr-2 font-medium">Дата</th>
              <th className="py-1.5 pr-2 font-medium">Сумма</th>
              <th className="py-1.5 pr-2 font-medium">Остаток после</th>
              <th className="py-1.5 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((p) => (
              <tr key={p.n} className="border-b border-black/10">
                <td className="py-1.5 pr-2">{p.n}</td>
                <td className="py-1.5 pr-2">{p.date} г.</td>
                <td className="py-1.5 pr-2">{money(p.amount)}</td>
                <td className="py-1.5 pr-2">{money(p.remaining)}</td>
                <td className="py-1.5">
                  {p.status === "paid" ? "Оплачен" : "Ожидается"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-8 text-xs text-black/40">
        Сформировано в CRM «Nasiya» · {new Date().toLocaleDateString("ru-RU")}
      </p>
    </div>
  );
}
