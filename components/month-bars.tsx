"use client";

import { useState } from "react";

// Столбики по месяцам: одна серия, одна ось, скруглённый верх, подсказка
// при наведении на колонку. Общий для разделов аналитики.

function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export interface MonthBar {
  key: string;
  /** Подпись под столбиком — коротко, например «нояб.». */
  label: string;
  /** Заголовок подсказки — полностью, например «ноябрь 2025». */
  title?: string;
  value: number;
  /** Вторая строка подсказки. */
  note?: string;
}

export default function MonthBars({
  bars,
  format,
  ariaLabel,
  tone = "brand",
  emptyText = "нет данных",
}: {
  bars: MonthBar[];
  format: (v: number) => string;
  ariaLabel: string;
  tone?: "brand" | "danger";
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 720;
  const h = 200;
  const max = Math.max(...bars.map((b) => b.value), 0);
  const slot = w / Math.max(bars.length, 1);
  const barW = Math.min(slot * 0.5, 36);
  const color = tone === "danger" ? "var(--color-danger)" : "var(--color-brand)";
  const hovered = hover !== null ? bars[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-48 w-full sm:h-56"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1="0"
            x2={w}
            y1={h - h * t + 0.5}
            y2={h - h * t + 0.5}
            stroke="var(--color-line)"
            strokeDasharray="3 5"
          />
        ))}
        <line x1="0" x2={w} y1={h - 0.5} y2={h - 0.5} stroke="var(--color-line)" />
        {bars.map((b, i) => {
          const x = slot * i;
          const barH = max > 0 && b.value > 0 ? Math.max((b.value / max) * (h - 16), 4) : 0;
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={0} width={slot} height={h} fill="transparent" />
              {hover === i && (
                <rect x={x} y={0} width={slot} height={h} fill="var(--color-brand-soft)" opacity="0.6" rx="6" />
              )}
              {barH > 0 && (
                <path
                  d={barPath(x + (slot - barW) / 2, h - barH, barW, barH, 4)}
                  fill={hover === i ? color : `color-mix(in oklch, ${color} 60%, transparent)`}
                />
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[10px] border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-pop"
          style={{ left: `${Math.min(Math.max(((hover! + 0.5) / bars.length) * 100, 12), 88)}%` }}
          role="status"
        >
          <p className="text-mute">{hovered.title ?? hovered.label}</p>
          <p className="font-semibold">{hovered.value ? format(hovered.value) : emptyText}</p>
          {hovered.note && <p className="text-mute">{hovered.note}</p>}
        </div>
      )}
      <div className="mt-2 flex text-xs text-mute">
        {bars.map((b, i) => (
          <span
            key={b.key}
            className={`flex-1 text-center ${bars.length > 6 && i % 2 === 1 ? "hidden sm:block" : ""}`}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
