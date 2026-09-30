"use client";

import { useState } from "react";
import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { useData, type SavedFilterPage } from "@/lib/store";

// Сохранённые наборы фильтров страницы: чипы для включения одним кликом и
// кнопка «Сохранить текущий». Фильтры личные — у каждого сотрудника свои.

const sameParams = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? "") === (b[k] ?? ""));
};

export default function SavedFilters({
  page,
  current,
  onApply,
  canSave,
}: {
  page: SavedFilterPage;
  /** Текущие значения фильтров страницы; пустые значения не сохраняются. */
  current: Record<string, string>;
  onApply: (params: Record<string, string>) => void;
  /** false — фильтры сейчас пустые, сохранять нечего. */
  canSave: boolean;
}) {
  const { savedFilters, saveFilter, deleteFilter } = useData();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const own = savedFilters.filter((f) => f.page === page);
  const compact = Object.fromEntries(Object.entries(current).filter(([, v]) => v !== ""));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveFilter(page, name.trim(), compact);
      setNaming(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  if (own.length === 0 && !canSave && !naming) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Сохранённые фильтры">
      {own.map((f) => {
        const active = sameParams(f.params, compact);
        return (
          <span
            key={f.id}
            className={`flex items-center rounded-full border text-sm ${
              active ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-surface text-mute"
            }`}
          >
            <button
              onClick={() => onApply(f.params)}
              aria-pressed={active}
              className="flex items-center gap-1.5 py-1 pr-1 pl-3 hover:text-ink"
            >
              <Bookmark size={13} aria-hidden />
              {f.name}
            </button>
            <button
              onClick={() => deleteFilter(f.id).catch(() => {})}
              aria-label={`Удалить фильтр «${f.name}»`}
              title="Удалить фильтр"
              className="rounded-full p-1.5 hover:text-danger"
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        );
      })}

      {naming ? (
        <form onSubmit={save} className="flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
            placeholder="Название фильтра"
            aria-label="Название фильтра"
            className="w-44 rounded-full border border-brand bg-surface px-3 py-1 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="rounded-full bg-brand px-3 py-1 text-sm font-medium text-on-brand disabled:bg-line disabled:text-mute"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="rounded-full px-2 py-1 text-sm text-mute hover:text-ink"
          >
            Отмена
          </button>
          {error && <span className="text-sm text-danger">{error}</span>}
        </form>
      ) : (
        canSave &&
        !own.some((f) => sameParams(f.params, compact)) && (
          <button
            onClick={() => setNaming(true)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1 text-sm text-mute hover:border-brand hover:text-brand-deep"
          >
            <BookmarkPlus size={13} aria-hidden />
            Сохранить фильтр
          </button>
        )
      )}
    </div>
  );
}
