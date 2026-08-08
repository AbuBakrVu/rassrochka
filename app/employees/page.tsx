"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  Briefcase,
  PhoneCall,
  CalendarClock,
  FileSearch,
  UserPlus2,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { computeEmployees } from "@/lib/derive";
import { ruPlural, type RouteKind } from "@/lib/data";

const kindMeta: Record<RouteKind, { label: string; icon: typeof PhoneCall; text: string }> = {
  overdue: { label: "Просрочка", icon: PhoneCall, text: "text-danger" },
  deadline: { label: "Дедлайн", icon: CalendarClock, text: "text-warn" },
  review: { label: "Проверка", icon: FileSearch, text: "text-brand" },
  request: { label: "Новая заявка", icon: UserPlus2, text: "text-brand" },
};

export default function EmployeesPage() {
  const { deals, paidPayments } = useData();
  const stats = useMemo(
    () => computeEmployees(deals, paidPayments),
    [deals, paidPayments]
  );

  return (
    <>
      <PageHeader
        title="Сотрудники"
        subtitle={`${stats.length} ${ruPlural(stats.length, "менеджер", "менеджера", "менеджеров")} в команде`}
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <Card key={s.employee.id} className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                  {s.employee.id}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold tracking-tight">
                    {s.employee.name}
                  </h2>
                  <p className="flex items-center gap-1.5 text-sm text-mute">
                    <Briefcase size={13} className="shrink-0" aria-hidden />
                    {s.employee.role}
                  </p>
                </div>
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

              <p className="mt-3 text-xs text-mute">
                В команде с {s.employee.since} · закрыто {s.closed}
                {s.rejected > 0 ? `, отказов ${s.rejected}` : ""}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
