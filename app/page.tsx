import Link from "next/link";
import {
  Clock,
  Briefcase,
  AlertCircle,
  Users,
  ArrowRight,
} from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import {
  fmt,
  kpi,
  priorities,
  newRequests,
  deadlines,
  inflowChart,
} from "@/lib/data";

const dotTone = {
  blue: "bg-brand",
  yellow: "bg-warn",
  red: "bg-danger",
} as const;

function InflowChart() {
  const w = 700;
  const h = 220;
  const max = 220;
  const pts = inflowChart.map((p) => ({
    x: ((p.d - 1) / 30) * w,
    y: h - (p.v / max) * h,
  }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-48 w-full sm:h-56"
      preserveAspectRatio="none"
      role="img"
      aria-label="График плановых поступлений за август"
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1="0"
          x2={w}
          y1={h * t}
          y2={h * t}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
      ))}
      <path d={area} fill="var(--color-brand)" opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const kpis = [
  {
    label: "К оплате сегодня",
    value: fmt(kpi.dueToday.value),
    note: kpi.dueToday.note,
    noteClass: "text-mute",
    icon: Clock,
  },
  {
    label: "Портфель",
    value: "4,82 млн ₽",
    note: kpi.portfolio.note,
    noteClass: "text-good",
    icon: Briefcase,
  },
  {
    label: "Просрочка",
    value: fmt(kpi.overdue.value),
    note: kpi.overdue.note,
    noteClass: "text-danger",
    icon: AlertCircle,
  },
  {
    label: "Активные клиенты",
    value: String(kpi.activeClients.value),
    note: kpi.activeClients.note,
    noteClass: "text-mute",
    icon: Users,
  },
];

export default function Home() {
  return (
    <>
      <PageHeader
        title="Главная"
        subtitle="Оперативный контроль портфеля"
        searchPlaceholder="Найти клиента или сделку"
        cta="+ Добавить"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Добрый день, Алексей
            </h2>
            <p className="mt-1 text-sm text-mute">
              Здесь собраны только действия и цифры, которые требуют решения
              сегодня.
            </p>
          </div>
          <span className="rounded-[10px] border border-line bg-surface px-4 py-2 text-sm text-mute">
            Сегодня · 5 августа
          </span>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(({ label, value, note, noteClass, icon: Icon }) => (
            <Card key={label} className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-mute">{label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                  <Icon size={17} aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-semibold tracking-tight">
                {value}
              </p>
              <p className={`mt-1 text-sm ${noteClass}`}>{note}</p>
            </Card>
          ))}
        </div>

        {/* График + приоритеты */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">План поступлений</h3>
              <Link
                href="/analytics"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                Аналитика <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-4 text-sm text-mute">
              Факт и ожидаемые оплаты за август
            </p>
            <InflowChart />
            <div className="mt-2 flex justify-between text-xs text-mute">
              {["1 авг", "8 авг", "15 авг", "22 авг", "31 авг"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Приоритеты</h3>
              <Link
                href="/route"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                Все <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-2 text-sm text-mute">Очередь на сегодня</p>
            <ul className="divide-y divide-line">
              {priorities.map((p) => (
                <li key={p.name} className="flex items-center gap-3 py-3.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${dotTone[p.tone]}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p
                      className={`truncate text-sm ${
                        p.tone === "red" ? "text-danger" : "text-mute"
                      }`}
                    >
                      {p.reason}
                    </p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {fmt(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Заявки + контроль срока */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Новые заявки</h3>
              <Link
                href="/deals"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                К списку <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-2 text-sm text-mute">
              Быстрая квалификация без лишних экранов
            </p>
            <ul className="divide-y divide-line">
              {newRequests.map((r) => (
                <li key={r.name} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="truncate text-sm text-mute">{r.text}</p>
                  </div>
                  <button className="rounded-[10px] bg-brand-soft px-3.5 py-2 text-sm font-medium text-brand-deep hover:bg-brand hover:text-white">
                    Проверить
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Контроль срока</h3>
              <Link
                href="/payments"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                Открыть <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-2 text-sm text-mute">
              Договоры с ближайшими событиями
            </p>
            <ul className="divide-y divide-line">
              {deadlines.map((d) => (
                <li key={d.title} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-sm text-mute">{d.text}</p>
                  </div>
                  <Badge tone={d.tone}>{d.badge}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
