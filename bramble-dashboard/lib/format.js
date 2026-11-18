import { CURRENCY, LOCALE } from "./config.js";

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const moneyWhole = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

export const formatMoney = (value) => money.format(value);
export const formatMoneyShort = (value) => moneyWhole.format(value);
export const formatNumber = (value) => number.format(value);

export function formatDay(ymd, options = { month: "short", day: "numeric" }) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
