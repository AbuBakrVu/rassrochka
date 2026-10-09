"use client";

// Поступления по месяцам: этот год против прошлого — две плавные линии с
// подсказкой при наведении. Раньше жил на главной, теперь — в Аналитике →
// Обзор (главная — про «сегодня»).

import { useState } from "react";
import { money } from "@/lib/schedule";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const short = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",")} млн`
    : n >= 1000
      ? `${Math.round(n / 1000)} тыс`
      : String(Math.round(n));

// Цвета аватаров — по первой букве, чтобы у клиента всегда был один цвет
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Путь столбика со скруглённым верхом и прямым основанием. */
// ── Обзор поступлений: две плавные линии ───────────────────────────────

export default function OverviewChart({
  current,
  previous,
  year,
  monthsShown,
}: {
  current: number[];
  previous: number[];
  year: number;
  /** Сколько месяцев текущего года уже наступило — дальше линия не рисуется. */
  monthsShown: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 760;
  const h = 200;
  const pad = 10;
  const max = Math.max(...current, ...previous, 1) * 1.15;
  const x = (i: number) => pad + ((w - pad * 2) * i) / 11;
  const y = (v: number) => h - (v / max) * (h - 10);
  const cur = current.slice(0, monthsShown).map((v, i) => [x(i), y(v)] as [number, number]);
  const prev = previous.map((v, i) => [x(i), y(v)] as [number, number]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <div className="flex gap-2">
      <div className="flex h-[200px] flex-col-reverse justify-between pb-0 text-right text-[11px] text-mute" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="leading-none">{t ? short(t) : "0"}</span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="h-[200px] w-full overflow-visible"
          role="img"
          aria-label={`Поступления по месяцам: ${year} год против ${year - 1}`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="ov-cur" x1="0" x2="1">
              <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.35" />
              <stop offset="0.25" stopColor="var(--color-brand)" />
              <stop offset="1" stopColor="var(--color-brand)" />
            </linearGradient>
            <linearGradient id="ov-prev" x1="0" x2="1">
              <stop offset="0" stopColor="var(--color-orange)" stopOpacity="0.35" />
              <stop offset="0.3" stopColor="var(--color-orange)" />
              <stop offset="1" stopColor="var(--color-orange)" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <path d={smoothPath(prev)} fill="none" stroke="url(#ov-prev)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          <path d={smoothPath(cur)} fill="none" stroke="url(#ov-cur)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={x(i) - (w - pad * 2) / 22}
              y={0}
              width={(w - pad * 2) / 11}
              height={h}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--color-line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* Точки поверх SVG — чтобы не растягивались вместе с ним */}
        {hover !== null && (
          <>
            {[
              { v: previous[hover], cls: "bg-orange" },
              ...(hover < monthsShown ? [{ v: current[hover], cls: "bg-brand" }] : []),
            ].map((d, i) => (
              <span
                key={i}
                className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${d.cls}`}
                style={{ left: `${(x(hover) / w) * 100}%`, top: y(d.v) }}
              />
            ))}
            <div
              className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 gap-4 rounded-[14px] bg-surface px-3.5 py-2.5 text-xs shadow-pop"
              style={{ left: `${Math.min(Math.max((x(hover) / w) * 100, 14), 86)}%` }}
              role="status"
            >
              <span>
                <span className="flex items-center gap-1.5 text-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {MONTHS[hover]} {year}
                </span>
                <span className="mt-0.5 block font-medium">
                  {hover < monthsShown ? money(current[hover]) : "—"}
                </span>
              </span>
              <span className="border-l border-line pl-4">
                <span className="flex items-center gap-1.5 text-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange" /> {year - 1}
                </span>
                <span className="mt-0.5 block font-medium">{money(previous[hover])}</span>
              </span>
            </div>
          </>
        )}
        <div className="mt-2 flex justify-between text-[11px] text-mute">
          {MONTHS_SHORT.map((m) => (
            <span key={m} className="w-0 text-center whitespace-nowrap first:text-left">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
