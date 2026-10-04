"use client";

import { useState } from "react";
import { ArrowRight, RefreshCw, CheckCheck } from "lucide-react";
import RestructureModal, { type RestructureSubmit } from "@/components/restructure-modal";
import { money } from "@/lib/schedule";

export default function DealActions({
  dealId,
  clientName,
  remaining,
  monthly,
  primaryLabel,
  canRestructure,
  onPrimary,
  onRestructure,
  onCloseEarly,
  layout = "row",
}: {
  dealId: string;
  clientName: string;
  remaining: number;
  monthly: number;
  primaryLabel: string;
  canRestructure: boolean;
  onPrimary?: () => void;
  onRestructure: RestructureSubmit;
  onCloseEarly?: () => Promise<void>;
  /** stack — главная кнопка на всю ширину, остальные под ней (узкая карточка). */
  layout?: "row" | "stack";
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const closeEarly = async () => {
    if (!onCloseEarly) return;
    if (!confirm(`Закрыть сделку ${dealId} досрочно? Остаток ${money(remaining)} спишется одним платежом.`)) return;
    setClosing(true);
    try {
      await onCloseEarly();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось закрыть сделку");
    } finally {
      setClosing(false);
    }
  };

  const stack = layout === "stack";
  const secondary = `flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface py-2.5 font-medium whitespace-nowrap ${
    stack ? "px-3 text-[13px]" : "px-4 text-sm"
  } text-mute hover:border-brand hover:text-brand-deep disabled:opacity-50 ${stack ? "flex-1" : ""}`;
  const label = stack ? "" : "hidden sm:inline";

  const primary = (
    <button
      type="button"
      onClick={onPrimary}
      disabled={!onPrimary}
      className={`flex items-center justify-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60 ${
        stack ? "w-full py-3" : ""
      }`}
    >
      {primaryLabel} <ArrowRight size={15} aria-hidden />
    </button>
  );

  return (
    <div className={stack ? "flex flex-col gap-2" : "flex shrink-0 flex-wrap items-center gap-2"}>
      {stack && primary}
      {(canRestructure || onCloseEarly) && (
        <div className={stack ? "flex gap-2" : "contents"}>
          {canRestructure && (
            <button type="button" onClick={() => setOpen(true)} className={secondary}>
              <RefreshCw size={15} aria-hidden />
              <span className={label}>Изменить график</span>
            </button>
          )}
          {onCloseEarly && (
            <button type="button" onClick={closeEarly} disabled={closing} className={secondary}>
              <CheckCheck size={15} aria-hidden />
              <span className={label}>{stack ? "Завершить" : "Завершить сделку"}</span>
            </button>
          )}
        </div>
      )}
      {!stack && primary}
      {open && (
        <RestructureModal
          dealId={dealId}
          clientName={clientName}
          remaining={remaining}
          currentMonthly={monthly}
          onClose={() => setOpen(false)}
          onSubmit={onRestructure}
        />
      )}
    </div>
  );
}
