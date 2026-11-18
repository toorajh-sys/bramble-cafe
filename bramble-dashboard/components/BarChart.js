import { niceMax } from "../lib/stats.js";
import { formatDay, formatMoney, formatMoneyShort } from "../lib/format.js";

const W = 800;
const H = 280;
const PAD = { top: 12, right: 12, bottom: 28, left: 56 };

export default function BarChart({ series, weekly }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...series.map((d) => d.revenue), 0));
  const slot = innerW / series.length;
  const barW = Math.max(1, slot * 0.72);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(series.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={weekly ? "Revenue by week" : "Revenue by day"} className="chart">
      {ticks.map((t) => {
        const y = PAD.top + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="grid" />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="axis">
              {formatMoneyShort(max * t)}
            </text>
          </g>
        );
      })}
      {series.map((d, i) => {
        const h = (d.revenue / max) * innerH;
        const x = PAD.left + i * slot + (slot - barW) / 2;
        return (
          <g key={d.day}>
            <rect x={x} y={PAD.top + innerH - h} width={barW} height={Math.max(h, d.revenue > 0 ? 1 : 0)} rx={Math.min(3, barW / 2)} className="bar">
              <title>{`${weekly ? "Week of " : ""}${formatDay(d.day, { month: "short", day: "numeric", year: "numeric" })}: ${formatMoney(d.revenue)}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="axis">
                {formatDay(d.day)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
