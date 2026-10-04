"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { allocatePayment } from "@/lib/payments";
import { money, type Installment } from "@/lib/schedule";
import { ruPlural } from "@/lib/data";

// Калькулятор досрочного погашения: «чтобы закрыть сегодня, внесите X» и
// «что будет, если внести сумму Y». Считает теми же правилами, что сервер
// (lib/payments.ts). Общий для карточки сделки и кабинета клиента — поэтому
// без стора: получает готовый график (с учётом уже внесённого) через props.

export default function PayoffCalculator({
  schedule,
  onAccept,
  note,
}: {
  schedule: Installment[];
  /** В CRM — провести введённую сумму как платёж. В кабинете клиента не передаётся. */
  onAccept?: (amount: number) => void;
  /** Подпись внизу — в кабинете: как оплатить. */
  note?: string;
}) {
  const due = schedule.filter((p) => p.status === "due");
  const remaining = Math.round(due.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const [input, setInput] = useState(due[0] ? String(Math.round(due[0].amount)) : "");

  if (due.length === 0) {
    return <p className="text-sm text-mute">Рассрочка полностью выплачена.</p>;
  }

  const amount = Number(input.replace(/\s/g, "").replace(",", "."));
  const result = Number.isFinite(amount)
    ? allocatePayment(due.map((p) => p.amount), 0, 0, amount)
    : null;
  const closesAll = result?.ok && result.paid === due.length;
  const nextIdx = result?.ok ? result.paid : 0;
  const next = due[nextIdx];
  const left = result?.ok ? due.length - result.paid : due.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] bg-brand-soft px-4 py-3">
        <p className="text-sm text-brand-deep">Закрыть рассрочку сегодня целиком</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight">{money(remaining)}</p>
        <p className="text-xs text-mute">
          {due.length} {ruPlural(due.length, "взнос", "взноса", "взносов")} · последний по графику{" "}
          {due[due.length - 1].date}
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
          <Calculator size={14} aria-hidden /> Сколько внести сейчас
        </span>
        <input
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:bg-surface"
        />
      </label>

      <div className="text-sm" role="status" aria-live="polite">
        {!result || !result.ok ? (
          <p className="text-danger">
            {result && !result.ok && result.error === "TOO_HIGH"
              ? `Больше остатка — достаточно ${money(result.max)}`
              : "Введите сумму больше нуля"}
          </p>
        ) : closesAll ? (
          <p className="font-medium text-good">Рассрочка будет закрыта полностью.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-mute">
            <li>
              {result.paid > 0
                ? `Закроет ${result.paid} ${ruPlural(result.paid, "взнос", "взноса", "взносов")}`
                : "Частичная оплата ближайшего взноса"}
              {result.credit > 0 && `, ${money(result.credit)} пойдёт в счёт следующего`}.
            </li>
            {next && (
              <li>
                Следующий платёж — {next.date}: {money(next.amount - result.credit)}
              </li>
            )}
            <li>
              Останется {left} {ruPlural(left, "платёж", "платежа", "платежей")} на{" "}
              {money(remaining - amount)}
            </li>
          </ul>
        )}
      </div>

      {onAccept && result?.ok && (
        <button
          type="button"
          onClick={() => onAccept(amount)}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
        >
          Принять {money(amount)}
        </button>
      )}
      {note && <p className="text-xs text-mute">{note}</p>}
    </div>
  );
}
