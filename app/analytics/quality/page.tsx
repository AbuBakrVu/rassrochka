"use client";

import { ShieldAlert, Users, Tags, CalendarRange, Info } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import AnalyticsTabs from "@/components/analytics-tabs";
import MonthBars from "@/components/month-bars";
import { useData } from "@/lib/store";
import { computeQuality, type QualityRow } from "@/lib/quality";
import { money } from "@/lib/schedule";
import { GRACE_DAYS } from "@/lib/credit";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Цвет доли просрочки: до 5% — норма, до 15% — внимание, выше — плохо. */
function parTone(par: number) {
  if (par <= 0.05) return { text: "text-good", bg: "bg-good", label: "норма" };
  if (par <= 0.15) return { text: "text-warn", bg: "bg-warn", label: "внимание" };
  return { text: "text-danger", bg: "bg-danger", label: "высокая" };
}

function ParCell({ par }: { par: number }) {
  const tone = parTone(par);
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${tone.bg}`} style={{ width: `${Math.min(par * 100, 100)}%` }} />
      </div>
      <span className={`font-medium tabular-nums ${tone.text}`}>{pct(par)}</span>
      <span className="sr-only">— {tone.label}</span>
    </div>
  );
}

function QualityTable({
  icon: Icon,
  title,
  text,
  rows,
  first,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  rows: QualityRow[];
  first: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
        <Icon size={16} className="text-brand" aria-hidden />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="px-5 pb-4 text-sm text-mute sm:px-6">{text}</p>
      {rows.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-mute sm:px-6">Выданных сделок пока нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-mute">
                <th className="px-5 py-2.5 font-medium sm:px-6">{first}</th>
                <th className="px-3 py-2.5 text-right font-medium">Выдано</th>
                <th className="px-3 py-2.5 text-right font-medium">Остаток</th>
                <th className="px-3 py-2.5 text-right font-medium">Просрочено</th>
                <th className="px-3 py-2.5 font-medium">Доля в просрочке</th>
                <th className="px-3 py-2.5 text-right font-medium">Свыше 30 дн</th>
                <th className="px-3 py-2.5 pr-5 text-right font-medium sm:pr-6">Вовремя</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-5 py-3 sm:px-6">
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-mute">
                      {r.issued} сд. · закрыто {r.closed}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(r.issuedSum)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(r.outstanding)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.overdueSum > 0 ? (
                      <span className="text-danger">{money(r.overdueSum)}</span>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                    <p className="text-xs text-mute">
                      {r.overdueDeals} из {r.activeDeals} акт.
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <ParCell par={r.par} />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.par30 > 0 ? <span className="text-danger">{pct(r.par30)}</span> : <span className="text-mute">0%</span>}
                  </td>
                  <td className="px-3 py-3 pr-5 text-right tabular-nums sm:pr-6">
                    {r.onTimeRate === null ? <span className="text-mute">—</span> : pct(r.onTimeRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function QualityPage() {
  const { deals, paidPayments, cash, employees } = useData();
  const q = computeQuality(deals, paidPayments, cash, employees);
  const t = q.total;
  const tone = parTone(t.par);
  const worstCategory = q.byCategory.find((r) => r.outstanding > 0 && r.par > t.par);

  const kpis = [
    {
      label: "Доля портфеля в просрочке",
      value: pct(t.par),
      note: `${money(t.outstanding)} остатка, ${t.overdueDeals} сд. с просрочкой`,
      cls: tone.text,
    },
    {
      label: "Просрочка свыше 30 дней",
      value: pct(t.par30),
      note: "самая тяжёлая часть портфеля",
      cls: t.par30 > 0 ? "text-danger" : "",
    },
    {
      label: "Просрочено к оплате",
      value: money(t.overdueSum),
      note: "взносы, срок которых уже прошёл",
      cls: t.overdueSum > 0 ? "text-danger" : "",
    },
    {
      label: "Платежи вовремя",
      value: t.onTimeRate === null ? "—" : pct(t.onTimeRate),
      note: `не позже ${GRACE_DAYS} дней после даты взноса`,
      cls: "",
    },
  ];

  return (
    <>
      <PageHeader title="Аналитика" subtitle="Качество портфеля: где деньги возвращаются хуже" />
      <AnalyticsTabs />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5">
              <p className="text-sm text-mute">{k.label}</p>
              <p className={`mt-2 text-[26px] font-semibold tracking-tight ${k.cls}`}>{k.value}</p>
              <p className="mt-1 text-sm text-mute">{k.note}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <CalendarRange size={16} className="text-brand" aria-hidden />
            <h2 className="font-semibold">Просрочка по месяцу выдачи</h2>
          </div>
          <p className="mb-4 text-sm text-mute">
            Доля остатка в просрочке у сделок, выданных в каждом месяце. Рост
            к свежим месяцам — сигнал, что ослабла проверка клиентов.
          </p>
          {q.byMonth.length === 0 ? (
            <p className="text-sm text-mute">Выданных сделок пока нет.</p>
          ) : (
            <MonthBars
              bars={q.byMonth.map((m) => ({
                key: m.key,
                label: m.label,
                title: m.title,
                value: Math.round(m.par * 1000) / 10,
                note: `${m.issued} сд. · остаток ${money(m.outstanding)}`,
              }))}
              format={(v) => `${v}% в просрочке`}
              emptyText="просрочки нет"
              tone="danger"
              ariaLabel="Доля просрочки по месяцу выдачи сделок"
            />
          )}
        </Card>

        {worstCategory && (
          <div className="mt-4 flex items-start gap-3 rounded-card border border-warn-soft bg-warn-soft px-5 py-4 text-sm">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <p>
              Хуже всего возвращаются деньги в категории{" "}
              <b className="font-semibold">«{worstCategory.label}»</b>:{" "}
              {pct(worstCategory.par)} остатка в просрочке при {pct(t.par)} в среднем.
              Стоит строже проверять клиентов или брать больший первый взнос.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4">
          <QualityTable
            icon={Users}
            title="По менеджерам"
            text="Чьи сделки возвращаются хуже — сверху самые проблемные"
            rows={q.byManager}
            first="Менеджер"
          />
          <QualityTable
            icon={Tags}
            title="По категориям товара"
            text="Какие товары чаще всего уходят в просрочку"
            rows={q.byCategory}
            first="Категория"
          />
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-mute">
          <Info size={13} className="mt-px shrink-0" aria-hidden />
          Учитываются выданные сделки — активные и закрытые. «Доля в
          просрочке» — остаток сделок, у которых есть просроченный взнос,
          делённый на весь остаток группы.
        </p>
      </div>
    </>
  );
}
