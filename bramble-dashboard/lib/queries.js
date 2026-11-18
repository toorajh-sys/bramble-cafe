import { sql } from "./db.js";
import { bucketWeeks, fillDays, rangeStart } from "./stats.js";

const MAX_DAILY_POINTS = 100;

export async function loadDashboard(range) {
  const [bounds] = await sql(
    "select min(sale_date)::text as first_day, max(sale_date)::text as last_day, count(*)::int as lines from sales",
  );
  if (!bounds.lines) return null;

  const start = rangeStart(bounds.last_day, range) ?? bounds.first_day;
  const end = bounds.last_day;

  const dailyRows = await sql(
    `select sale_date::text as day, sum(revenue)::float8 as revenue, sum(quantity)::float8 as units
       from sales where sale_date between $1::date and $2::date group by sale_date order by sale_date`,
    [start, end],
  );
  const items = await sql(
    `select min(item) as item, sum(quantity)::float8 as units, sum(revenue)::float8 as revenue
       from sales where sale_date between $1::date and $2::date
      group by lower(item) order by sum(quantity) desc, sum(revenue) desc limit 50`,
    [start, end],
  );

  const days = fillDays(dailyRows, start, end);
  const weekly = days.length > MAX_DAILY_POINTS;
  const series = weekly ? bucketWeeks(days) : days;
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const totalUnits = days.reduce((s, d) => s + d.units, 0);
  const activeDays = dailyRows.length;
  const bestDay = dailyRows.reduce((best, d) => (!best || d.revenue > best.revenue ? d : best), null);

  return {
    start,
    end,
    firstDay: bounds.first_day,
    weekly,
    series,
    items,
    totalRevenue,
    totalUnits,
    activeDays,
    bestDay,
    averagePerDay: activeDays ? totalRevenue / activeDays : 0,
  };
}
