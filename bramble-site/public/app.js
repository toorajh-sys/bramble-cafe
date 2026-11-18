const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };
const DISPLAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function money(value) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value) : "";
}

function formatTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

function minutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function nowInZone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = Number(get("hour"));
  const dayPeriod = get("dayPeriod").toLowerCase();
  if (hour === 24) hour = 0;
  if (dayPeriod.startsWith("pm") && hour < 12) hour += 12;
  if (dayPeriod.startsWith("am") && hour === 12) hour = 0;
  return {
    day: get("weekday").slice(0, 3).toLowerCase(),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  };
}

function dish(item) {
  const row = el("div", "dish");
  const text = el("div");
  text.append(el("div", "dish-name", item.name));
  if (item.description) text.append(el("p", "dish-desc", item.description));
  row.append(text, el("div", "price", money(item.price)));
  return row;
}

function renderStatus(content, now) {
  const today = content.hours[now.day];
  const status = document.getElementById("open-status");
  if (!today) {
    status.textContent = "Closed today";
    status.className = "status closed";
    return;
  }
  const [open, close] = today;
  if (now.minutes >= minutes(open) && now.minutes < minutes(close)) {
    status.textContent = `Open now until ${formatTime(close)}`;
    status.className = "status open";
  } else if (now.minutes < minutes(open)) {
    status.textContent = `Opens today at ${formatTime(open)}`;
    status.className = "status closed";
  } else {
    status.textContent = "Closed for today";
    status.className = "status closed";
  }
}

function renderHours(content, now) {
  const body = document.getElementById("hours-body");
  for (const key of DISPLAY_ORDER) {
    const hours = content.hours[key];
    const row = el("tr", key === now.day ? "today" : "");
    row.append(el("th", "", DAY_NAMES[key]), el("td", "", hours ? `${formatTime(hours[0])} - ${formatTime(hours[1])}` : "Closed"));
    body.append(row);
  }
  const contact = [content.address, content.phone].filter(Boolean).join("  ·  ");
  document.getElementById("contact").textContent = contact;
}

function showSpecials(items) {
  const list = document.getElementById("specials-list");
  list.replaceChildren();
  const dishes = items.filter((item) => item && typeof item.name === "string" && item.name.trim() !== "").slice(0, 3);
  if (dishes.length === 0) {
    list.append(el("p", "empty", "No specials today. Our full menu is below."));
    return;
  }
  dishes.forEach((item) => list.append(dish({
    name: item.name,
    description: typeof item.description === "string" ? item.description : "",
    price: typeof item.price === "number" ? item.price : undefined,
  })));
}

async function renderSpecials(content, now) {
  document.getElementById("specials-title").textContent = "Today's specials";
  if (!content.specialsUrl) {
    showSpecials([]);
    return;
  }
  try {
    const url = new URL(content.specialsUrl, window.location.href);
    url.searchParams.set("date", now.date);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    showSpecials(Array.isArray(data.items) ? data.items : []);
  } catch {
    showSpecials([]);
  }
}

function renderMenu(content) {
  const root = document.getElementById("menu-list");
  for (const group of content.menu) {
    const card = el("section", "card");
    card.append(el("h3", "", group.category));
    group.items.forEach((item) => card.append(dish(item)));
    root.append(card);
  }
}

async function main() {
  try {
    const response = await fetch("content.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    const content = await response.json();
    const now = nowInZone(content.timezone || "UTC");
    document.getElementById("name").textContent = content.name;
    document.getElementById("tagline").textContent = content.tagline ?? "";
    document.title = `${content.name} cafe: menu, hours and today's specials`;
    renderStatus(content, now);
    await renderSpecials(content, now);
    renderHours(content, now);
    renderMenu(content);
  } catch {
    document.getElementById("load-error").hidden = false;
    document.getElementById("specials").hidden = true;
    document.getElementById("hours").hidden = true;
    document.getElementById("menu").hidden = true;
  }
}

main();
