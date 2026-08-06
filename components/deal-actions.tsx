"use client";

import { useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import RestructureModal from "@/components/restructure-modal";

export default function DealActions({
  dealId,
  clientName,
  remaining,
  monthly,
  primaryLabel,
  canRestructure,
}: {
  dealId: string;
  clientName: string;
  remaining: number;
  monthly: number;
  primaryLabel: string;
  canRestructure: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-2">
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
      <button className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep">
        {primaryLabel} <ArrowRight size={15} aria-hidden />
      </button>
      {open && (
        <RestructureModal
          dealId={dealId}
          clientName={clientName}
          remaining={remaining}
          currentMonthly={monthly}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
