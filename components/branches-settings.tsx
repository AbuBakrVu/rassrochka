"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { Card } from "@/components/ui";
import { useData, type Branch } from "@/lib/store";

const field =
  "w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

/**
 * Настройки → Филиалы. Пока филиал один, интерфейс филиалов нигде не
 * показывается; второй филиал включает переключатель в шапке, выбор
 * филиала в сделке и у сотрудника.
 */
export default function BranchesSettings() {
  const { user, branches, deals, employees, saveBranch } = useData();
  const isAdmin = user.role === "admin";
  const [editing, setEditing] = useState<Branch | "new" | null>(null);

  const dealCount = (id: number) => deals.filter((d) => d.branchId === id && d.stage === "active").length;
  const staffCount = (id: number) => employees.filter((e) => e.branchId === id && e.active).length;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold tracking-tight">Филиалы</h2>
          <p className="mt-1 text-sm text-mute">
            У каждого филиала свои клиенты, сделки и касса. Сотрудник, привязанный к
            филиалу, видит только его; администратор и сотрудники без филиала —
            все, с переключателем в шапке.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
          >
            <Plus size={15} aria-hidden /> Открыть филиал
          </button>
        )}
      </div>

      <ul className="mt-4 divide-y divide-line">
        {branches.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                b.active ? "bg-brand-soft text-brand-deep" : "bg-canvas text-mute"
              }`}
            >
              <MapPin size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {b.name}
                {!b.active && <span className="ml-2 text-xs font-normal text-mute">закрыт</span>}
              </p>
              <p className="truncate text-xs text-mute">
                {b.address ? `${b.address} · ` : ""}
                активных сделок {dealCount(b.id)} · сотрудников {staffCount(b.id)}
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditing(b)}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-mute hover:text-ink"
              >
                Изменить
              </button>
            )}
          </li>
        ))}
      </ul>
      {!isAdmin && <p className="mt-2 text-xs text-mute">Филиалы настраивает администратор.</p>}

      {editing && (
        <BranchModal
          branch={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await saveBranch(input);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function BranchModal({
  branch,
  onClose,
  onSave,
}: {
  branch: Branch | null;
  onClose: () => void;
  onSave: (input: { id?: number; name: string; address?: string; active?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(branch?.name ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [active, setActive] = useState(branch?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...(branch ? { id: branch.id } : {}), name: name.trim(), address: address.trim(), active });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-scrim" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="branch-title" className="font-semibold tracking-tight">
            {branch ? "Филиал" : "Новый филиал"}
          </h2>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Название</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Филиал на Ленина" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Адрес <span className="text-xs text-mute">необязательно</span>
            </span>
            <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. Ленина, 12" />
          </label>
          {branch && (
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={!active}
                onChange={(e) => setActive(!e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
              />
              <span>
                Филиал закрыт
                <span className="block text-xs text-mute">
                  Новые сделки в нём не оформить. Клиенты, сделки и касса остаются и видны в «Все филиалы».
                </span>
              </span>
            </label>
          )}
        </div>
        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Сохраняем…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Сохранить
          </button>
        </footer>
      </form>
    </div>
  );
}
