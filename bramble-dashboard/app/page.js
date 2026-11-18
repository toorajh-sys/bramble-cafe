import Link from "next/link";
import { headers } from "next/headers";
import { getIdentity } from "../cursor/identity.js";
import { loadDashboard } from "../lib/queries.js";
import { formatDay, formatMoney, formatNumber } from "../lib/format.js";
import { CAFE_NAME } from "../lib/config.js";
import BarChart from "../components/BarChart.js";
import UploadPanel from "../components/UploadPanel.js";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "all", label: "All time" },
];

export default async function Page({ searchParams }) {
  const identity = await getIdentity(await headers());
  if (!identity.verified) {
    return (
      <main className="shell">
        <section className="card">
          <h1>Sign in to see the dashboard</h1>
          <p className="muted">This page is private. Open it while signed in to Cursor.</p>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const range = RANGES.some((r) => r.key === params?.range) ? params.range : "30";
  const data = await loadDashboard(range);
  const firstName = identity.kind === "person" && identity.name ? identity.name.split(" ")[0] : null;

  return (
    <main className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">{CAFE_NAME} cafe</p>
          <h1>{firstName ? `Hi ${firstName}, here is how sales are going` : "Sales dashboard"}</h1>
        </div>
        {data && (
          <nav className="ranges" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r.key} href={`/?range=${r.key}`} className={r.key === range ? "active" : ""} aria-current={r.key === range ? "page" : undefined}>
                {r.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {!data ? (
        <section className="card empty">
          <h2>No sales yet</h2>
          <p className="muted">Upload a spreadsheet below and your daily sales and best sellers will appear here.</p>
        </section>
      ) : (
        <>
          <p className="muted range-note">
            Showing {formatDay(data.start, { month: "short", day: "numeric", year: "numeric" })} to{" "}
            {formatDay(data.end, { month: "short", day: "numeric", year: "numeric" })}, counted back from your latest uploaded day.
          </p>
          <section className="kpis" aria-label="Summary">
            <Kpi label="Total sales" value={formatMoney(data.totalRevenue)} />
            <Kpi label="Items sold" value={formatNumber(data.totalUnits)} />
            <Kpi label="Average per trading day" value={formatMoney(data.averagePerDay)} />
            <Kpi
              label="Best day"
              value={data.bestDay ? formatMoney(data.bestDay.revenue) : "-"}
              sub={data.bestDay ? formatDay(data.bestDay.day, { weekday: "short", month: "short", day: "numeric" }) : ""}
            />
          </section>

          <section className="card" aria-labelledby="daily-title">
            <h2 id="daily-title">{data.weekly ? "Sales by week" : "Sales by day"}</h2>
            <BarChart series={data.series} weekly={data.weekly} />
          </section>

          <section className="card" aria-labelledby="items-title">
            <h2 id="items-title">Best-selling items</h2>
            <BestSellers items={data.items} />
          </section>
        </>
      )}

      <UploadPanel hasData={Boolean(data)} />

      <footer className="foot muted">
        {identity.simulated ? "Local preview with a simulated viewer." : identity.email ? `Signed in as ${identity.email}.` : ""}
      </footer>
    </main>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub ? <span className="kpi-sub">{sub}</span> : null}
    </div>
  );
}

function BestSellers({ items }) {
  const top = items.slice(0, 10);
  const maxUnits = Math.max(...top.map((i) => i.units), 1);
  return (
    <ol className="best">
      {top.map((item, index) => (
        <li key={item.item}>
          <span className="rank">{index + 1}</span>
          <div className="best-body">
            <div className="best-row">
              <span className="best-name">{item.item}</span>
              <span className="best-stats">
                {formatNumber(item.units)} sold <span className="dot">·</span> {formatMoney(item.revenue)}
              </span>
            </div>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${(item.units / maxUnits) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
