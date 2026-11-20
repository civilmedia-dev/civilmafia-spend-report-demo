"use client";

import { useMemo, useRef, useState } from "react";
import { PLATFORMS, type Platform } from "@/lib/types";
import type { MonthlyRow } from "@/lib/aggregate";
import { fmtCompact, fmtInt, fmtMoney, fmtMonth } from "@/lib/format";

export const PLATFORM_COLOR: Record<Platform, string> = {
  Basis: "var(--p-basis)",
  Meta: "var(--p-meta)",
  "Google Ads": "var(--p-google)",
  TikTok: "var(--p-tiktok)",
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

const W = 800;

type Tip = { x: number; y: number; lines: string[] } | null;

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: React.PointerEvent, lines: string[]) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: Math.min(e.clientX - box.left + 12, box.width - 200), y: e.clientY - box.top - 10, lines });
  };
  return { ref, tip, show, hide: () => setTip(null) };
}

function TipBox({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="cm-tip" style={{ left: Math.max(0, tip.x), top: Math.max(0, tip.y) }}>
      {tip.lines.map((l, i) => (i === 0 ? <b key={i} style={{ display: "block" }}>{l}</b> : <div key={i}>{l}</div>))}
    </div>
  );
}

export function StackedMonthly({ rows, currency }: { rows: MonthlyRow[]; currency: string }) {
  const { ref, tip, show, hide } = useTip();
  const H = 300, ml = 56, mb = 28, mt = 8;
  const max = useMemo(() => niceMax(Math.max(0, ...rows.map((r) => r.spend))), [rows]);
  if (!rows.length) return <p className="cm-empty">No hay datos para estos filtros.</p>;
  const step = (W - ml - 4) / rows.length;
  const bw = step * 0.74;
  const y = (v: number) => H - mb - (v / max) * (H - mb - mt);
  const every = Math.ceil(rows.length / 12);
  return (
    <div className="cm-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Spend mensual por plataforma en ${currency}`}>
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={ml} x2={W - 4} y1={y(t)} y2={y(t)} stroke="var(--grid-line)" strokeWidth={t === 0 ? 0 : 1} />
            <text x={ml - 8} y={y(t) + 4} textAnchor="end">{fmtCompact(t)}</text>
          </g>
        ))}
        <line x1={ml} x2={W - 4} y1={H - mb} y2={H - mb} stroke="var(--border-strong)" />
        {rows.map((r, i) => {
          let acc = 0;
          const x = ml + i * step + (step - bw) / 2;
          return (
            <g key={r.month}>
              {PLATFORMS.map((p) => {
                const v = r[p];
                if (!v) return null;
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                return <rect key={p} x={x} width={bw} y={y1} height={Math.max(0, y0 - y1)} fill={PLATFORM_COLOR[p]} />;
              })}
              {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle">{fmtMonth(r.month)}</text>}
              <rect
                x={ml + i * step} width={step} y={0} height={H - mb} fill="transparent"
                onPointerMove={(e) => show(e, [`${fmtMonth(r.month)} · ${fmtMoney(r.spend, currency)}`, ...PLATFORMS.filter((p) => r[p] > 0).map((p) => `${p}: ${fmtMoney(r[p], currency)}`)])}
                onPointerLeave={hide}
              />
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

export function MonthlyLine({ rows, field, label }: { rows: MonthlyRow[]; field: "impressions" | "clicks"; label: string }) {
  const { ref, tip, show, hide } = useTip();
  const H = 200, ml = 48, mb = 26, mt = 10;
  const max = niceMax(Math.max(0, ...rows.map((r) => r[field])));
  if (!rows.length) return <p className="cm-empty">No hay datos para estos filtros.</p>;
  const x = (i: number) => ml + 8 + (rows.length === 1 ? 0 : (i * (W - ml - 24)) / (rows.length - 1));
  const y = (v: number) => H - mb - (v / max) * (H - mb - mt);
  const d = rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r[field])}`).join("");
  const every = Math.ceil(rows.length / 6);
  const last = rows.length - 1;
  return (
    <div className="cm-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} por mes`}>
        {ticks(max, 3).map((t) => (
          <g key={t}>
            <line x1={ml} x2={W - 4} y1={y(t)} y2={y(t)} stroke="var(--grid-line)" />
            <text x={ml - 8} y={y(t) + 4} textAnchor="end" style={{ fontSize: 16 }}>{fmtCompact(t)}</text>
          </g>
        ))}
        <path d={`${d}L${x(last)},${H - mb}L${x(0)},${H - mb}Z`} fill="var(--cm-blue)" opacity={0.18} />
        <path d={d} fill="none" stroke="var(--cm-blue-tint)" strokeWidth={2.5} />
        <circle cx={x(last)} cy={y(rows[last][field])} r={5} fill="var(--cm-blue-tint)" />
        {rows.map((r, i) => (
          <g key={r.month}>
            {i % every === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" style={{ fontSize: 16 }}>{fmtMonth(r.month)}</text>}
            <circle cx={x(i)} cy={y(r[field])} r={16} fill="transparent"
              onPointerMove={(e) => show(e, [`${fmtMonth(r.month)}`, `${label}: ${fmtInt(r[field])}`])} onPointerLeave={hide} />
          </g>
        ))}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}
