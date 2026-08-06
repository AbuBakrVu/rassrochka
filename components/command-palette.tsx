"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  ArrowRight,
  CornerDownLeft,
  SearchX,
} from "lucide-react";
import { useData } from "@/lib/store";

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("");

export default function CommandPalette() {
  const { clients, deals } = useData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpenRequest = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) setQuery("");
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

  if (!open) return null;

  const empty = clientResults.length === 0 && dealResults.length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]">
      <button
        aria-label="Закрыть поиск"
        className="absolute inset-0 bg-ink/30"
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Клиент, телефон, сделка или товар…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-mute"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-mute">
            Esc
          </kbd>
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {empty ? (
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
            <>
              {clientResults.length > 0 && (
                <div className="px-2 pb-2">
                  <p className="px-2.5 py-1.5 text-xs font-semibold tracking-wide text-mute uppercase">
                    Клиенты
                  </p>
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => go(`/clients/${c.id}`)}
                      className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left hover:bg-canvas"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {c.name}
                        </span>
                        <span className="block truncate text-xs text-mute">
                          {c.phone}
                        </span>
                      </span>
                      <ArrowRight
                        size={14}
                        className="shrink-0 text-mute"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              )}

              {dealResults.length > 0 && (
                <div className="px-2 pb-2">
                  <p className="px-2.5 py-1.5 text-xs font-semibold tracking-wide text-mute uppercase">
                    Сделки
                  </p>
                  {dealResults.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => go(`/deals/${d.id}`)}
                      className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left hover:bg-canvas"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                        <Package size={14} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {d.product}
                        </span>
                        <span className="block truncate text-xs text-mute">
                          {d.id} · {d.client}
                        </span>
                      </span>
                      <ArrowRight
                        size={14}
                        className="shrink-0 text-mute"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-mute">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft size={12} aria-hidden /> открыть
          </span>
          <span>⌘K в любой момент</span>
        </div>
      </div>
    </div>
  );
}
