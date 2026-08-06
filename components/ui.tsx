"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import NewClientModal from "@/components/new-client-modal";
import NewDealModal from "@/components/new-deal-modal";
import AcceptPaymentModal from "@/components/accept-payment-modal";
import {
  Search,
  Bell,
  Inbox,
  UserPlus,
  FilePlus2,
  HandCoins,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  searchPlaceholder,
  cta,
}: {
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  cta?: string;
}) {
  return (
    <div className="border-b border-line bg-surface px-4 py-4 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-0.5 truncate text-sm text-mute">{subtitle}</p>
        </div>
        {searchPlaceholder && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="hidden w-64 items-center gap-2 rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-mute transition-colors hover:border-brand/40 hover:text-ink md:flex"
          >
            <Search size={16} className="shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">
              {searchPlaceholder}
            </span>
            <kbd className="shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium">
              ⌘K
            </kbd>
          </button>
        )}
        <button
          aria-label="Уведомления"
          className="relative rounded-[10px] border border-line bg-surface p-2.5 text-mute hover:text-ink"
        >
          <Bell size={17} />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
        {cta && <CtaMenu label={cta} />}
      </div>
    </div>
  );
}

function CtaMenu({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"client" | "deal" | "payment" | null>(
    null
  );
  const wrap = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Меню не должно оставаться раскрытым после перехода в другой раздел
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { icon: FilePlus2, label: "Создать сделку", action: () => setModal("deal") },
    {
      icon: UserPlus,
      label: "Создать клиента",
      action: () => setModal("client"),
    },
    {
      icon: HandCoins,
      label: "Принять платёж",
      action: () => setModal("payment"),
    },
  ];

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-deep"
      >
        {label}
        <ChevronDown
          size={15}
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-56 rounded-[12px] border border-line bg-surface p-1.5 shadow-pop"
        >
          {items.map(({ icon: Icon, label: text, action }) => (
            <button
              key={text}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action();
              }}
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-brand-soft hover:text-brand-deep"
            >
              <Icon size={16} className="text-brand" aria-hidden />
              {text}
            </button>
          ))}
        </div>
      )}
      {modal === "client" && <NewClientModal onClose={() => setModal(null)} />}
      {modal === "deal" && <NewDealModal onClose={() => setModal(null)} />}
      {modal === "payment" && (
        <AcceptPaymentModal onClose={() => setModal(null)} />
      )}
    </div>
  );
}

const tones = {
  blue: "bg-brand-soft text-brand-deep",
  yellow: "bg-warn-soft text-warn",
  green: "bg-good-soft text-good",
  red: "bg-danger-soft text-danger",
  gray: "bg-canvas text-mute",
} as const;

export function Badge({
  tone,
  children,
}: {
  tone: keyof typeof tones;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-card border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  text,
  action,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon size={22} aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-mute">{text}</p>
      {action && (
        <button
          onClick={onAction}
          className="mt-4 rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[10px] bg-line/60 ${className}`} />
  );
}
