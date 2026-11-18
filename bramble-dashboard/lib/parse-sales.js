const COLUMN_ALIASES = {
  date: ["date", "sale date", "order date", "transaction date", "day", "datetime", "date time", "timestamp", "time", "created", "created at", "paid at"],
  item: ["item", "item name", "product", "product name", "menu item", "name", "description", "sku"],
  quantity: ["quantity", "qty", "units", "units sold", "count", "sold", "number sold"],
  total: ["total", "line total", "item total", "revenue", "sales", "net sales", "gross sales", "amount", "total sales", "extended price", "subtotal"],
  price: ["price", "unit price", "item price", "cost"],
};

const MAX_ERRORS_SHOWN = 5;

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const exact = headers.indexOf(alias);
    if (exact !== -1) return exact;
  }
  for (const alias of aliases) {
    const partial = headers.findIndex((h) => h.split(" ").includes(alias));
    if (partial !== -1) return partial;
  }
  return -1;
}

export function detectColumns(headerRow) {
  const headers = headerRow.map(normalizeHeader);
  const used = new Set();
  const pick = (key) => {
    const aliases = COLUMN_ALIASES[key];
    const masked = headers.map((h, i) => (used.has(i) ? "\u0000" : h));
    const index = findColumn(masked, aliases);
    if (index !== -1) used.add(index);
    return index;
  };
  const date = pick("date");
  const item = pick("item");
  const quantity = pick("quantity");
  const total = pick("total");
  const price = total === -1 ? pick("price") : -1;
  return { date, item, quantity, total, price };
}

export function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.trim();
  if (text === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[^\d.,-]/g, "");
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  }
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    const decimals = text.length - lastComma - 1;
    text = decimals === 3 && lastDot === -1 ? text.replace(/,/g, "") : text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const number = Number(text);
  if (text === "" || !Number.isFinite(number)) return null;
  return negative ? -number : number;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function validYmd(y, m, d) {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function detectSlashOrder(values) {
  for (const value of values) {
    const match = typeof value === "string" ? value.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/) : null;
    if (match && Number(match[1]) > 12) return "dmy";
  }
  return "mdy";
}

export function parseDate(value, slashOrder = "mdy") {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return validYmd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      const date = new Date(Math.round((value - 25569) * 86400000));
      return validYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/);
  if (match) return validYmd(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:$|[T\s,])/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const [first, second] = [Number(match[1]), Number(match[2])];
    return slashOrder === "dmy" ? validYmd(year, second, first) : validYmd(year, first, second);
  }
  if (/[a-z]{3}/i.test(text)) {
    const parsed = new Date(`${text} UTC`);
    if (!Number.isNaN(parsed.getTime())) {
      return validYmd(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
    }
  }
  return null;
}

function cleanItem(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function isBlankRow(row) {
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
}

/**
 * Turns spreadsheet rows (first row = headers) into sale lines.
 * Throws an Error with a message meant for the cafe owner when the sheet cannot be understood.
 */
export function rowsToSales(rows) {
  const dataRows = rows.filter((row) => Array.isArray(row));
  const headerIndex = dataRows.findIndex((row) => !isBlankRow(row));
  if (headerIndex === -1) throw new Error("The spreadsheet is empty.");
  const columns = detectColumns(dataRows[headerIndex]);
  const missing = [];
  if (columns.date === -1) missing.push("a date column (e.g. \"Date\")");
  if (columns.item === -1) missing.push("an item column (e.g. \"Item\")");
  if (columns.total === -1 && columns.price === -1) missing.push("a money column (e.g. \"Total\" or \"Price\")");
  if (missing.length > 0) {
    throw new Error(`Could not find ${missing.join(", ")}. The first row needs headers such as Date, Item, Qty, Total.`);
  }

  const body = dataRows.slice(headerIndex + 1).filter((row) => !isBlankRow(row));
  const slashOrder = detectSlashOrder(body.map((row) => row[columns.date]));
  const sales = [];
  const problems = [];
  let skipped = 0;

  body.forEach((row, i) => {
    const line = headerIndex + i + 2;
    const saleDate = parseDate(row[columns.date], slashOrder);
    const item = cleanItem(row[columns.item]);
    const quantity = columns.quantity === -1 ? 1 : parseMoney(row[columns.quantity]);
    const amount = parseMoney(row[columns.total !== -1 ? columns.total : columns.price]);
    let reason = null;
    if (!saleDate) reason = "unreadable date";
    else if (item === "") reason = "missing item name";
    else if (quantity === null) reason = "unreadable quantity";
    else if (amount === null) reason = "unreadable amount";
    if (reason) {
      skipped += 1;
      if (problems.length < MAX_ERRORS_SHOWN) problems.push(`Row ${line}: ${reason}`);
      return;
    }
    const revenue = columns.total !== -1 ? amount : amount * quantity;
    sales.push({
      saleDate,
      item,
      quantity: Math.round(quantity * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
    });
  });

  if (sales.length === 0) {
    throw new Error(`No usable sales rows found. ${problems.join("; ")}`.trim());
  }
  return { sales, skipped, problems };
}
