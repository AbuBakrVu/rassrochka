"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  ArrowRight,
  CornerDownLeft,
  SearchX,
  HandCoins,
  type LucideIcon,
} from "lucide-react";
import { useData } from "@/lib/store";
import { can } from "@/lib/permissions";
import { dealState } from "@/lib/data";
import { CreateModals, useCreateItems, type CreateModal } from "@/components/ui";
import AcceptPaymentModal from "@/components/accept-payment-modal";

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("");

/** Раздел меню, в который можно перейти из палитры. */
export type PaletteSection = { href: string; label: string; icon: LucideIcon };

/** Одна строка палитры: стрелки ходят по всем строкам подряд, Enter — run. */
type Item = {
  key: string;
  group: "Действия" | "Клиенты" | "Сделки" | "Разделы";
  run: () => void;
  node: React.ReactNode;
  /** Платёж по найденной активной сделке — кнопка справа в строке. */
  payDealId?: string;
};

export default function CommandPalette({ sections = [] }: { sections?: PaletteSection[] }) {
  const { clients, deals, user } = useData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [modal, setModal] = useState<CreateModal>(null);
  const [payDeal, setPayDeal] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setActive(0);
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpenRequest = () => {
      setQuery("");
      setActive(0);
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const q = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");

  const clientResults = useMemo(() => {
    if (!q) return clients.slice(0, 5);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
      )
      .slice(0, 6);
  }, [q, digits, clients]);

  const dealResults = useMemo(() => {
    if (!q) return deals.slice(0, 5);
    return deals
      .filter(
        (d) =>
          d.id.toLowerCase().includes(q) ||
          d.product.toLowerCase().includes(q) ||
          d.client.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [q, deals]);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };
  const startModal = (m: CreateModal) => {
    setOpen(false);
    setModal(m);
  };
  const createItems = useCreateItems(startModal);
  const canPay = can(user, "payments.accept");
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  const items: Item[] = [
    ...createItems
      .filter((a) => matches(a.label))
      .map(({ icon: Icon, label, action }) => ({
        key: `a:${label}`,
        group: "Действия" as const,
        run: action,
        node: (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
              <Icon size={15} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
          </>
        ),
      })),
    ...clientResults.map((c) => ({
      key: `c:${c.id}`,
      group: "Клиенты" as const,
      run: () => go(`/clients/${c.id}`),
      node: (
        <>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
            {initials(c.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{c.name}</span>
            <span className="block truncate text-xs text-mute">{c.phone}</span>
          </span>
        </>
      ),
    })),
    ...dealResults.map((d) => ({
      key: `d:${d.id}`,
      group: "Сделки" as const,
      run: () => go(`/deals/${d.id}`),
      payDealId: canPay && dealState(d) === "active" ? d.id : undefined,
      node: (
        <>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
            <Package size={14} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{d.product}</span>
            <span className="block truncate text-xs text-mute">
              {d.id} · {d.client}
            </span>
          </span>
        </>
      ),
    })),
    // Разделы — только по запросу, чтобы пустая палитра не превращалась в меню
    ...(q
      ? sections
          .filter((s) => matches(s.label))
          .map(({ href, label, icon: Icon }) => ({
            key: `s:${href}`,
            group: "Разделы" as const,
            run: () => go(href),
            node: (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-mute">
                  <Icon size={15} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
              </>
            ),
          }))
      : []),
  ];

  const current = Math.min(active, Math.max(items.length - 1, 0));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (items.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[current].run();
    }
  };

  const modals = (
    <>
      <CreateModals modal={modal} onClose={() => setModal(null)} />
      {payDeal && <AcceptPaymentModal initialDealId={payDeal} onClose={() => setPayDeal(null)} />}
    </>
  );

  if (!open) return modals;

  return (
    <>
      {modals}
      <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]">
        <button
          aria-label="Закрыть поиск"
          className="absolute inset-0 bg-scrim"
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Быстрый поиск"
          className="relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-card bg-surface shadow-pop"
        >
          <label className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <Search size={18} className="shrink-0 text-mute" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded
              aria-controls="palette-results"
              aria-activedescendant={items[current] ? `palette-${items[current].key}` : undefined}
              placeholder="Клиент, телефон, сделка, раздел или действие…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-mute"
            />
            <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-mute">
              Esc
            </kbd>
          </label>

          <div id="palette-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto py-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <SearchX size={18} aria-hidden />
                </span>
                <p className="text-sm font-medium">Ничего не нашли</p>
                <p className="mt-1 text-sm text-mute">
                  Попробуйте имя, телефон, номер сделки или название товара
                </p>
              </div>
            ) : (
              items.map((item, i) => (
                <div key={item.key} className="px-2">
                  {item.group !== items[i - 1]?.group && (
                    <p className="px-2.5 pt-2 pb-1.5 text-xs font-semibold tracking-wide text-mute uppercase">
                      {item.group}
                    </p>
                  )}
                  <div
                    id={`palette-${item.key}`}
                    role="option"
                    aria-selected={i === current}
                    ref={i === current ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                    onMouseMove={() => setActive(i)}
                    className={`flex items-center gap-1 rounded-[14px] ${i === current ? "bg-canvas" : ""}`}
                  >
                    <button
                      tabIndex={-1}
                      onClick={item.run}
                      className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left"
                    >
                      {item.node}
                      {!item.payDealId && <ArrowRight size={14} className="shrink-0 text-mute" aria-hidden />}
                    </button>
                    {item.payDealId && (
                      <button
                        tabIndex={-1}
                        onClick={() => {
                          setOpen(false);
                          setPayDeal(item.payDealId!);
                        }}
                        className="mr-2 flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-deep hover:bg-brand hover:text-on-brand"
                      >
                        <HandCoins size={13} aria-hidden /> Принять
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-mute">
            <span className="flex items-center gap-1.5">
              ↑↓ выбрать · <CornerDownLeft size={12} aria-hidden /> открыть
            </span>
            <span>⌘K в любой момент</span>
          </div>
        </div>
      </div>
    </>
  );
}
