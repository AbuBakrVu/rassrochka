"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { can } from "@/lib/permissions";
import {
  Phone,
  Mail,
  Briefcase,
  PhoneCall,
  CalendarClock,
  FileSearch,
  UserPlus2,
  Pencil,
  MapPin,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import TeamTabs from "@/components/team-tabs";
import { money } from "@/lib/schedule";
import { useData, type Branch, type CustomRole, type Employee, type EmployeeRole } from "@/lib/store";
import { ROLE_LABEL, roleTitle } from "@/lib/permissions";
import { computeEmployees } from "@/lib/derive";
import { completion, computePlanFact } from "@/lib/collection-plan";
import { todayIso } from "@/lib/status";
import { ruPlural, type RouteKind } from "@/lib/data";

const kindMeta: Record<RouteKind, { label: string; icon: typeof PhoneCall; text: string }> = {
  overdue: { label: "Просрочка", icon: PhoneCall, text: "text-danger" },
  deadline: { label: "Дедлайн", icon: CalendarClock, text: "text-warn" },
  review: { label: "Проверка", icon: FileSearch, text: "text-brand" },
  request: { label: "Новая заявка", icon: UserPlus2, text: "text-brand" },
};

interface RoleBranch {
  role: EmployeeRole;
  roleId?: number;
  branchId: number | null;
}

export default function EmployeesPage() {
  const {
    deals, paidPayments, cash, employees: allEmployees, user, addEmployee, updateEmployee, setEmployeeActive,
    branches, roles, branchView, multiBranch,
  } = useData();
  // В выбранном филиале — его сотрудники и те, у кого доступ ко всем
  const employees = useMemo(
    () =>
      branchView === "all"
        ? allEmployees
        : allEmployees.filter((e) => e.branchId === undefined || e.branchId === branchView),
    [allEmployees, branchView]
  );
  const stats = useMemo(
    () => computeEmployees(employees, deals, paidPayments),
    [employees, deals, paidPayments]
  );

  // План сборов месяца по каждому — тот же расчёт, что в Аналитике → План/факт
  // (с целями администратора, если они заданы; без права на аналитику — по графикам)
  const month = todayIso().slice(0, 7);
  const [targets, setTargets] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    if (!can(user, "analytics")) return;
    let cancelled = false;
    fetch(`/api/collection-plan/targets?month=${month}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { managerId: number; amount: number }[]) => {
        if (!cancelled) setTargets(new Map(rows.map((x) => [x.managerId, x.amount])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, month]);
  const plan = useMemo(() => {
    const pf = computePlanFact({ month, deals, cash, managers: allEmployees, branches, targets });
    return new Map(pf.byManager.map((r) => [r.key, r]));
  }, [month, deals, cash, allEmployees, branches, targets]);
  const isAdmin = user.role === "admin";
  // В «Сотрудники» пускает и право на журнал — без права на команду ведём
  // сразу во вкладку журнала
  const router = useRouter();
  const seesTeam = can(user, "employees");
  useEffect(() => {
    if (!seesTeam) router.replace("/journal");
  }, [seesTeam, router]);
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
        subtitle={`${stats.length} ${ruPlural(stats.length, "сотрудник", "сотрудника", "сотрудников")} в команде`}
      />
      <TeamTabs />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {isAdmin && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
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
                    {roleTitle(s.employee, roles)}
                    {!s.employee.active && " · доступ закрыт"}
                  </p>
                  {multiBranch && (
                    <p className="flex items-center gap-1.5 text-sm text-mute">
                      <MapPin size={13} className="shrink-0" aria-hidden />
                      {s.employee.branchId === undefined
                        ? "Все филиалы"
                        : (branches.find((b) => b.id === s.employee.branchId)?.name ?? "—")}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setEditing(s.employee)}
                    title="Редактировать"
                    className="shrink-0 rounded-[16px] border border-line p-1.5 text-mute transition-colors hover:border-brand/40 hover:text-ink"
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
                <div className="rounded-[14px] bg-canvas px-2 py-2.5">
                  <p className="text-lg font-semibold tracking-tight">
                    {s.active}
                  </p>
                  <p className="text-xs text-mute">Активных</p>
                </div>
                <div className="rounded-[14px] bg-canvas px-2 py-2.5">
                  <p
                    className={`text-lg font-semibold tracking-tight ${
                      s.overdue > 0 ? "text-danger" : ""
                    }`}
                  >
                    {s.overdue}
                  </p>
                  <p className="text-xs text-mute">Просрочек</p>
                </div>
                <div className="rounded-[14px] bg-canvas px-2 py-2.5">
                  <p className="text-lg font-semibold tracking-tight">
                    {s.newLeads}
                  </p>
                  <p className="text-xs text-mute">Новых</p>
                </div>
              </div>

              {(() => {
                const row = plan.get(String(s.employee.id));
                if (!row || row.plan <= 0) return null;
                const pct = completion(row) ?? 0;
                return (
                  <Link
                    href="/analytics/plan"
                    className="mt-3 block rounded-[16px] border border-line px-3 py-2.5 text-sm hover:border-brand/40"
                    title="Подробно — Аналитика → План/факт"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-mute">План сборов месяца</span>
                      <span className={`font-medium tabular-nums ${pct >= 100 ? "text-good" : pct >= 80 ? "text-warn" : "text-danger"}`}>
                        {pct}%
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </span>
                    <span className="mt-1 block text-xs text-mute">
                      собрано {money(row.fact)} из {money(row.plan)}
                    </span>
                  </Link>
                );
              })()}

              <div className="mt-3 flex items-center justify-between rounded-[16px] bg-brand-soft px-3 py-2.5 text-sm">
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
                          className="flex items-center gap-2 rounded-[10px] px-1.5 py-1 text-sm transition-colors hover:bg-canvas"
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
                    className="shrink-0 rounded-[10px] border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
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
          branches={branches}
          roles={roles}
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
          branches={branches}
          roles={roles}
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
  "w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

/**
 * Роль и филиал сотрудника. Роль — встроенная или своя из Настройки → Роли;
 * филиал — только если их больше одного, «Все филиалы» видят всю компанию.
 */
function RoleBranchFields({
  value,
  onChange,
  branches,
  roles,
}: {
  value: RoleBranch;
  onChange: (v: RoleBranch) => void;
  branches: Branch[];
  roles: CustomRole[];
}) {
  const roleKey = value.role === "custom" ? `custom:${value.roleId}` : value.role;
  const hint =
    value.role === "admin"
      ? "Видит всё во всех филиалах, приглашает сотрудников и меняет настройки."
      : value.role === "accountant"
        ? "Видит финансы и аналитику, ведёт ручные операции кассы."
        : value.role === "manager"
          ? "Ведёт клиентов и сделки, принимает платежи."
          : "Права роли настраиваются в Настройки → Роли.";

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Роль</span>
        <select
          className={field}
          value={roleKey}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("custom:")) onChange({ ...value, role: "custom", roleId: Number(v.slice(7)) });
            else onChange({ ...value, role: v as EmployeeRole, roleId: undefined });
          }}
        >
          {(["manager", "accountant", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
          {roles.length > 0 && (
            <optgroup label="Свои роли">
              {roles.map((r) => (
                <option key={r.id} value={`custom:${r.id}`}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <span className="mt-1.5 block text-xs text-mute">{hint}</span>
      </label>
      {branches.length > 1 && value.role !== "admin" && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Филиал</span>
          <select
            className={field}
            value={value.branchId ?? ""}
            onChange={(e) => onChange({ ...value, branchId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Все филиалы</option>
            {branches
              .filter((b) => b.active || b.id === value.branchId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
          <span className="mt-1.5 block text-xs text-mute">
            С филиалом сотрудник видит и ведёт только его клиентов, сделки и кассу.
          </span>
        </label>
      )}
    </>
  );
}

function InviteModal({
  onClose,
  onCreate,
  branches,
  roles,
}: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    email: string;
    phone: string;
  } & RoleBranch) => Promise<void>;
  branches: Branch[];
  roles: CustomRole[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState<RoleBranch>({ role: "manager", branchId: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "" && email.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), email: email.trim(), phone, ...access });
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
          <RoleBranchFields value={access} onChange={setAccess} branches={branches} roles={roles} />
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
            disabled={!ready || saving}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
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
  branches,
  roles,
}: {
  employee: Employee;
  onClose: () => void;
  onSave: (input: { name: string; phone: string } & RoleBranch) => Promise<void>;
  branches: Branch[];
  roles: CustomRole[];
}) {
  const [name, setName] = useState(employee.name);
  const [phone, setPhone] = useState(employee.phone === "—" ? "" : employee.phone);
  const [access, setAccess] = useState<RoleBranch>({
    role: employee.role,
    roleId: employee.roleId,
    branchId: employee.branchId ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), phone, ...access });
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
          <RoleBranchFields value={access} onChange={setAccess} branches={branches} roles={roles} />
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
            disabled={!ready || saving}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
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
        <p className="my-4 rounded-[14px] bg-canvas px-4 py-3 font-mono text-lg font-semibold tracking-wide">
          {data.password}
        </p>
        <p className="text-xs text-mute">
          Передайте его лично. При первом входе сотрудник обязан сменить пароль.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand hover:bg-brand-deep"
        >
          Записал
        </button>
      </div>
    </div>
  );
}
