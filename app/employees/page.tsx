"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  Briefcase,
  PhoneCall,
  CalendarClock,
  FileSearch,
  UserPlus2,
  Pencil,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { money } from "@/lib/schedule";
import { useData, type Employee, type EmployeeRole } from "@/lib/store";
import { computeEmployees } from "@/lib/derive";
import { ruPlural, type RouteKind } from "@/lib/data";

const kindMeta: Record<RouteKind, { label: string; icon: typeof PhoneCall; text: string }> = {
  overdue: { label: "Просрочка", icon: PhoneCall, text: "text-danger" },
  deadline: { label: "Дедлайн", icon: CalendarClock, text: "text-warn" },
  review: { label: "Проверка", icon: FileSearch, text: "text-brand" },
  request: { label: "Новая заявка", icon: UserPlus2, text: "text-brand" },
};

const ROLE_LABEL: Record<EmployeeRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  accountant: "Бухгалтер",
};

export default function EmployeesPage() {
  const { deals, paidPayments, employees, user, addEmployee, updateEmployee, setEmployeeActive } =
    useData();
  const stats = useMemo(
    () => computeEmployees(employees, deals, paidPayments),
    [employees, deals, paidPayments]
  );
  const isAdmin = user.role === "admin";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const toggle = async (id: number, active: boolean) => {
    setBusy(id);
    try {
      await setEmployeeActive(id, active);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось изменить доступ");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Сотрудники"
        subtitle={`${stats.length} ${ruPlural(stats.length, "менеджер", "менеджера", "менеджеров")} в команде`}
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {isAdmin && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
            >
              <UserPlus2 size={16} aria-hidden /> Пригласить сотрудника
            </button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <Card key={s.employee.id} className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    s.employee.active
                      ? "bg-brand text-on-brand"
                      : "bg-canvas text-mute"
                  }`}
                >
                  {s.employee.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold tracking-tight">
                    {s.employee.name}
                  </h2>
                  <p className="flex items-center gap-1.5 text-sm text-mute">
                    <Briefcase size={13} className="shrink-0" aria-hidden />
                    {ROLE_LABEL[s.employee.role]}
                    {!s.employee.active && " · доступ закрыт"}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setEditing(s.employee)}
                    title="Редактировать"
                    className="shrink-0 rounded-[8px] border border-line p-1.5 text-mute transition-colors hover:border-brand/40 hover:text-ink"
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-1 text-sm text-mute">
                <a
                  href={`tel:${s.employee.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-1.5 hover:text-ink"
                >
                  <Phone size={13} className="shrink-0" aria-hidden />
                  {s.employee.phone}
                </a>
                <a
                  href={`mailto:${s.employee.email}`}
                  className="flex items-center gap-1.5 hover:text-ink"
                >
                  <Mail size={13} className="shrink-0" aria-hidden />
                  {s.employee.email}
                </a>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[10px] bg-canvas px-2 py-2.5">
                  <p className="text-lg font-semibold tracking-tight">
                    {s.active}
                  </p>
                  <p className="text-xs text-mute">Активных</p>
                </div>
                <div className="rounded-[10px] bg-canvas px-2 py-2.5">
                  <p
                    className={`text-lg font-semibold tracking-tight ${
                      s.overdue > 0 ? "text-danger" : ""
                    }`}
                  >
                    {s.overdue}
                  </p>
                  <p className="text-xs text-mute">Просрочек</p>
                </div>
                <div className="rounded-[10px] bg-canvas px-2 py-2.5">
                  <p className="text-lg font-semibold tracking-tight">
                    {s.newLeads}
                  </p>
                  <p className="text-xs text-mute">Новых</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-[10px] bg-brand-soft px-3 py-2.5 text-sm">
                <span className="text-brand-deep">
                  Портфель {money(s.portfolio)}
                </span>
                <span className="text-brand-deep">
                  Собрано {money(s.collected)}
                </span>
              </div>

              {s.topItems.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs font-medium text-mute">
                    Приоритеты
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {s.topItems.map((it) => {
                      const meta = kindMeta[it.kind];
                      const Icon = meta.icon;
                      return (
                        <Link
                          key={it.key}
                          href={`/deals/${it.dealId}`}
                          className="flex items-center gap-2 rounded-[8px] px-1.5 py-1 text-sm transition-colors hover:bg-canvas"
                        >
                          <Icon
                            size={13}
                            className={`shrink-0 ${meta.text}`}
                            aria-hidden
                          />
                          <span className="truncate text-ink">
                            {it.clientName}
                          </span>
                          <span className="truncate text-mute">
                            — {it.text.toLowerCase()}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-mute">
                  В команде с {s.employee.since} · закрыто {s.closed}
                  {s.rejected > 0 ? `, отказов ${s.rejected}` : ""}
                </p>
                {isAdmin && s.employee.id !== user.id && (
                  <button
                    onClick={() => toggle(s.employee.id, !s.employee.active)}
                    disabled={busy === s.employee.id}
                    className="shrink-0 rounded-[8px] border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
                  >
                    {s.employee.active ? "Закрыть доступ" : "Открыть доступ"}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onCreate={async (input) => {
            const { password } = await addEmployee(input);
            setIssued({ name: input.name, password });
            setInviteOpen(false);
          }}
        />
      )}

      {issued && (
        <PasswordIssued data={issued} onClose={() => setIssued(null)} />
      )}

      {editing && (
        <EditEmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await updateEmployee(editing.id, input);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

function InviteModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    email: string;
    phone: string;
    role: EmployeeRole;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<EmployeeRole>("manager");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "" && email.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), email: email.trim(), phone, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
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
        aria-labelledby="invite-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="invite-title" className="font-semibold tracking-tight">
            Пригласить сотрудника
          </h2>
          <p className="text-sm text-mute">
            Система выдаст временный пароль — передайте его лично
          </p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Имя и фамилия</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Мария Кузнецова" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Рабочая почта</span>
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="m.kuznetsova@example.ru" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Телефон <span className="text-xs text-mute">необязательно</span>
            </span>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 911 000-00-00" />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Роль</span>
            <div className="flex gap-2">
              {(["manager", "accountant", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${
                    role === r
                      ? "border-brand bg-brand-soft font-medium text-brand-deep"
                      : "border-line bg-canvas text-mute hover:border-brand/40"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-mute">
              Администратор может приглашать и отключать сотрудников. Бухгалтер
              видит только кассу и аналитику.
            </p>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Сохраняем…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Создать
          </button>
        </footer>
      </form>
    </div>
  );
}

function EditEmployeeModal({
  employee,
  onClose,
  onSave,
}: {
  employee: Employee;
  onClose: () => void;
  onSave: (input: { name: string; phone: string; role: EmployeeRole }) => Promise<void>;
}) {
  const [name, setName] = useState(employee.name);
  const [phone, setPhone] = useState(employee.phone === "—" ? "" : employee.phone);
  const [role, setRole] = useState<EmployeeRole>(employee.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), phone, role });
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
        aria-labelledby="edit-employee-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="edit-employee-title" className="font-semibold tracking-tight">
            Редактировать сотрудника
          </h2>
          <p className="text-sm text-mute">{employee.email} · почта не меняется здесь</p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Имя и фамилия</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Телефон <span className="text-xs text-mute">необязательно</span>
            </span>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 911 000-00-00" />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Роль</span>
            <div className="flex gap-2">
              {(["manager", "accountant", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${
                    role === r
                      ? "border-brand bg-brand-soft font-medium text-brand-deep"
                      : "border-line bg-canvas text-mute hover:border-brand/40"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Сохраняем…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Сохранить
          </button>
        </footer>
      </form>
    </div>
  );
}

function PasswordIssued({
  data,
  onClose,
}: {
  data: { name: string; password: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-pop">
        <p className="font-semibold tracking-tight">{data.name} добавлен</p>
        <p className="mt-1 text-sm text-mute">Временный пароль показывается один раз</p>
        <p className="my-4 rounded-[10px] bg-canvas px-4 py-3 font-mono text-lg font-semibold tracking-wide">
          {data.password}
        </p>
        <p className="text-xs text-mute">
          Передайте его лично. При первом входе сотрудник обязан сменить пароль.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand hover:bg-brand-deep"
        >
          Записал
        </button>
      </div>
    </div>
  );
}
