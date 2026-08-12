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

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {canRestructure && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-mute hover:border-brand hover:text-brand-deep"
        >
          <RefreshCw size={15} aria-hidden />
          <span className="hidden sm:inline">Изменить график</span>
        </button>
      )}
      {onCloseEarly && (
        <button
          type="button"
          onClick={closeEarly}
          disabled={closing}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-mute hover:border-brand hover:text-brand-deep disabled:opacity-50"
        >
          <CheckCheck size={15} aria-hidden />
          <span className="hidden sm:inline">Завершить сделку</span>
        </button>
      )}
      <button
        type="button"
        onClick={onPrimary}
        disabled={!onPrimary}
        className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {primaryLabel} <ArrowRight size={15} aria-hidden />
      </button>
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
