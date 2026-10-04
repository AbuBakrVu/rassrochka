"use client";

// Режим начисления соинвестору — общий для добавления и редактирования:
// доля от прибыли с каждого платежа или фиксированный % в месяц на капитал.

export type AccrualMode = "profit_share" | "fixed";

const field =
  "w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

const MODES: { key: AccrualMode; label: string; hint: string }[] = [
  {
    key: "profit_share",
    label: "Доля от прибыли",
    hint: "Начисляется с каждого оплаченного клиентом взноса — процент от наценки.",
  },
  {
    key: "fixed",
    label: "% в месяц на капитал",
    hint: "Начисляется сам в конце каждого месяца от среднего капитала за месяц.",
  },
];

export default function AccrualFields({
  mode,
  percent,
  onMode,
  onPercent,
}: {
  mode: AccrualMode;
  percent: string;
  onMode: (m: AccrualMode) => void;
  onPercent: (v: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">Как начислять доход</span>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onMode(m.key)}
            aria-pressed={mode === m.key}
            className={`rounded-[14px] border px-3 py-2.5 text-sm transition-colors ${
              mode === m.key
                ? "border-brand bg-brand-soft font-medium text-brand-deep"
                : "border-line bg-canvas text-mute hover:border-brand/40"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-mute">{MODES.find((m) => m.key === mode)!.hint}</p>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium">
          {mode === "fixed" ? "Ставка в месяц, %" : "Доля прибыли, %"}
        </span>
        <input
          inputMode="decimal"
          className={field}
          value={percent}
          onChange={(e) => onPercent(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
          placeholder={mode === "fixed" ? "3" : "10"}
        />
      </label>
    </div>
  );
}

/** Поля для API из выбранного режима и введённого процента. */
export const accrualPayload = (mode: AccrualMode, percent: string) =>
  mode === "fixed"
    ? { accrualMode: mode, monthlyRatePct: Number(percent), profitSharePct: 0 }
    : { accrualMode: mode, profitSharePct: Number(percent), monthlyRatePct: 0 };
