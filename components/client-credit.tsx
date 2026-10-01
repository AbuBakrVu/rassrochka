"use client";

import { useState } from "react";
import { ShieldCheck, Plus, Minus, Pencil, Gauge } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useData } from "@/lib/store";
import { computeClientCredit, GRACE_DAYS, SOURCE_LABEL, type ClientCredit } from "@/lib/credit";
import { money } from "@/lib/schedule";
import type { Client, RiskTone } from "@/lib/data";

const toneText: Record<RiskTone, string> = {
  green: "text-good",
  yellow: "text-warn",
  red: "text-danger",
};
const toneBg: Record<RiskTone, string> = {
  green: "bg-good",
  yellow: "bg-warn",
  red: "bg-danger",
};

/** Надёжность и лимит клиента одним вызовом — общий для карточки и мастера сделки. */
export function useClientCredit(client: Client | null): ClientCredit | null {
  const { deals, paidPayments, cash, clientDefaultLimit } = useData();
  if (!client) return null;
  return computeClientCredit(client, deals, paidPayments, cash, clientDefaultLimit);
}

/** Шкала «занято из лимита»: перерасход красным. */
function LimitBar({ credit }: { credit: ClientCredit }) {
  if (credit.limit === null) return null;
  const pct = credit.limit > 0 ? Math.min((credit.used / credit.limit) * 100, 100) : 100;
  const over = credit.available !== null && credit.available < 0;
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Использовано лимита"
    >
      <div
        className={`h-full rounded-full ${over ? "bg-danger" : pct > 80 ? "bg-warn" : "bg-brand"}`}
        style={{ width: `${Math.max(pct, credit.used > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

/** Карточка в правой колонке клиента: оценка, причины, лимит. */
export function ClientCreditCard({ client }: { client: Client }) {
  const { user, setClientCreditLimit } = useData();
  const credit = useClientCredit(client)!;
  const { risk, punctuality } = credit;
  const isAdmin = user.role === "admin";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (limit: number | null) => {
    setSaving(true);
    setError(null);
    try {
      await setClientCreditLimit(client.id, limit);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={16} className={toneText[risk.tone]} aria-hidden />
        <h2 className="font-semibold">Надёжность и лимит</h2>
      </div>
      <p className="mb-3 text-sm text-mute">
        По истории сделок и платежей клиента в вашей компании
      </p>

      <div className="flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={risk.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Оценка надёжности клиента"
        >
          <div className={`h-full rounded-full ${toneBg[risk.tone]}`} style={{ width: `${risk.score}%` }} />
        </div>
        <span className="text-sm font-semibold tabular-nums">{risk.score}</span>
      </div>
      <div className="mt-3">
        <Badge tone={risk.tone}>{risk.label}</Badge>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {risk.reasons.map((r) => (
          <li key={r.text} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                r.positive ? "bg-good-soft text-good" : "bg-danger-soft text-danger"
              }`}
            >
              {r.positive ? <Plus size={10} aria-hidden /> : <Minus size={10} aria-hidden />}
            </span>
            <span className="text-mute">{r.text}</span>
          </li>
        ))}
      </ul>
      {punctuality.total > 0 && (
        <p className="mt-2 text-xs text-mute">
          «Вовремя» — не позже {GRACE_DAYS} дней после даты взноса.
          {punctuality.late > 0 && ` Средняя задержка ${punctuality.avgLateDays} дн.`}
        </p>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm text-mute">
            <Gauge size={14} aria-hidden /> Лимит · {SOURCE_LABEL[credit.source]}
          </span>
          <span className="text-lg font-semibold tracking-tight">
            {credit.limit === null ? "Без лимита" : money(credit.limit)}
          </span>
        </div>
        <div className="mt-2">
          <LimitBar credit={credit} />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-mute">Занято</dt>
            <dd className="font-medium">{money(credit.used)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-mute">
              {credit.available !== null && credit.available < 0 ? "Превышен на" : "Доступно"}
            </dt>
            <dd
              className={`font-medium ${
                credit.available !== null && credit.available < 0 ? "text-danger" : "text-good"
              }`}
            >
              {credit.available === null ? "—" : money(Math.abs(credit.available))}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-mute">{credit.note}</p>

        {isAdmin && !client.blacklistedAt && !editing && (
          <button
            type="button"
            onClick={() => {
              setValue(credit.limit !== null ? String(credit.limit) : "");
              setEditing(true);
            }}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-deep"
          >
            <Pencil size={13} aria-hidden /> Изменить лимит
          </button>
        )}
        {editing && (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(value.replace(/\s/g, ""));
              if (!Number.isFinite(n) || n < 0) {
                setError("Введите сумму от 0");
                return;
              }
              void save(n);
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block text-mute">Лимит, ₽</span>
              <input
                inputMode="numeric"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-brand focus:bg-surface"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-[10px] bg-brand px-3.5 py-2 text-sm font-medium text-on-brand hover:bg-brand-deep disabled:opacity-60"
              >
                Сохранить
              </button>
              {credit.source === "manual" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save(null)}
                  className="rounded-[10px] border border-line px-3.5 py-2 text-sm font-medium text-mute hover:text-ink"
                >
                  Считать автоматически
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="px-2 py-2 text-sm text-mute hover:text-ink"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

/**
 * Сводка в мастере новой сделки: хватает ли лимита на эту сумму.
 * Возвращает признак перерасхода через overLimit, чтобы мастер мог
 * попросить подтверждение.
 */
export function ClientCreditSummary({
  credit,
  amount,
}: {
  credit: ClientCredit;
  amount: number;
}) {
  const afterDeal = credit.available === null ? null : credit.available - amount;
  const over = afterDeal !== null && afterDeal < 0;
  return (
    <div className="mt-2 rounded-[12px] border border-line bg-canvas/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={credit.risk.tone}>
          {credit.risk.label} · {credit.risk.score}
        </Badge>
        <span className="text-sm text-mute">
          Лимит {credit.limit === null ? "не ограничен" : money(credit.limit)}
          {credit.limit !== null && ` · занято ${money(credit.used)}`}
        </span>
      </div>
      {credit.limit !== null && (
        <div className="mt-2.5">
          <LimitBar credit={credit} />
        </div>
      )}
      {afterDeal !== null && amount > 0 && (
        <p className={`mt-2 text-sm ${over ? "font-medium text-danger" : "text-mute"}`}>
          {over
            ? `Сделка на ${money(amount)} превышает доступный лимит на ${money(-afterDeal)}`
            : `После сделки останется ${money(afterDeal)} лимита`}
        </p>
      )}
    </div>
  );
}

export const isOverLimit = (credit: ClientCredit | null, amount: number) =>
  !!credit && credit.available !== null && credit.available - amount < 0;
