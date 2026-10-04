"use client";

import { useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import { useData, type CustomRole } from "@/lib/store";
import { PERMISSION_GROUPS, permissionsFor, ROLE_LABEL, type Permission } from "@/lib/permissions";

/**
 * Настройки → Роли. Встроенные роли показаны для справки (их права не
 * меняются), свои — собираются галочками по разделам и действиям.
 * Администратор может всё, и это правами не описывается.
 */
export default function RolesSettings() {
  const { user, roles, employees, saveRole, deleteRole } = useData();
  const isAdmin = user.role === "admin";
  const [editing, setEditing] = useState<CustomRole | "new" | null>(null);

  const holders = (id: number) => employees.filter((e) => e.role === "custom" && e.roleId === id);

  const remove = async (role: CustomRole) => {
    if (!confirm(`Удалить роль «${role.name}»?`)) return;
    try {
      await deleteRole(role.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const summary = (perms: readonly Permission[]) => {
    const labels = PERMISSION_GROUPS[0].items.filter((i) => perms.includes(i.key)).map((i) => i.label);
    return labels.length ? labels.join(", ") : "нет разделов";
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold tracking-tight">Роли и права</h2>
          <p className="mt-1 text-sm text-mute">
            Своя роль — набор разделов и действий, например «Кассир» или «Старший
            менеджер». Права проверяются и на сервере: закрытый раздел не открыть
            и по прямой ссылке.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
          >
            <Plus size={15} aria-hidden /> Новая роль
          </button>
        )}
      </div>

      <ul className="mt-4 divide-y divide-line">
        {(["admin", "manager", "accountant"] as const).map((r) => (
          <li key={r} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-mute">
              <ShieldCheck size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {ROLE_LABEL[r]} <span className="text-xs font-normal text-mute">встроенная</span>
              </p>
              <p className="truncate text-xs text-mute">
                {r === "admin" ? "Все разделы и настройки компании" : summary(permissionsFor(r))}
              </p>
            </div>
          </li>
        ))}
        {roles.map((role) => {
          const people = holders(role.id);
          return (
            <li key={role.id} className="flex items-center gap-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                <ShieldCheck size={16} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{role.name}</p>
                <p className="truncate text-xs text-mute">
                  {summary(role.permissions)} · {people.length ? people.map((p) => p.name).join(", ") : "никому не назначена"}
                </p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing(role)}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-mute hover:text-ink"
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(role)}
                    aria-label={`Удалить роль ${role.name}`}
                    className="rounded-full border border-line p-1.5 text-mute hover:text-danger"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!isAdmin && <p className="mt-2 text-xs text-mute">Роли настраивает администратор.</p>}

      {editing && (
        <RoleModal
          role={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await saveRole(input);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function RoleModal({
  role,
  onClose,
  onSave,
}: {
  role: CustomRole | null;
  onClose: () => void;
  onSave: (input: { id?: number; name: string; permissions: Permission[] }) => Promise<void>;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [perms, setPerms] = useState<Set<Permission>>(() => new Set(role?.permissions ?? ["dashboard"]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (p: Permission) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...(role ? { id: role.id } : {}), name: name.trim(), permissions: [...perms] });
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
        aria-labelledby="role-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="role-title" className="font-semibold tracking-tight">
            {role ? "Права роли" : "Новая роль"}
          </h2>
          <p className="text-sm text-mute">Изменения действуют у всех сотрудников с этой ролью сразу</p>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Название</span>
            <input
              className="w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Кассир"
            />
          </label>
          {PERMISSION_GROUPS.map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-1.5 text-sm font-medium">{group.title}</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {group.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-start gap-2.5 rounded-[12px] px-2 py-1.5 text-sm hover:bg-canvas"
                  >
                    <input
                      type="checkbox"
                      checked={perms.has(item.key)}
                      onChange={() => toggle(item.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                    />
                    <span>
                      {item.label}
                      {item.hint && <span className="block text-xs text-mute">{item.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-xs text-mute">
            Действие включает и свой раздел: «Принимать платежи» откроет «Сделки». Настройки
            компании, сотрудники, удаление сделок и отмена платежей — только у администратора.
          </p>
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
