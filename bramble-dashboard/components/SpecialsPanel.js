"use client";

import { useEffect, useState } from "react";

const EMPTY = [
  { name: "", description: "", price: "" },
  { name: "", description: "", price: "" },
  { name: "", description: "", price: "" },
];

function fromServer(items) {
  const next = EMPTY.map((slot) => ({ ...slot }));
  items.slice(0, 3).forEach((item, index) => {
    next[index] = {
      name: item.name ?? "",
      description: item.description ?? "",
      price: item.price === null || item.price === undefined ? "" : String(item.price),
    };
  });
  return next;
}

export default function SpecialsPanel() {
  const [items, setItems] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [connectCode, setConnectCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/specials")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.items)) setItems(fromServer(data.items));
        if (data.connected === false && typeof data.connectionCode === "string") setConnectCode(data.connectionCode);
      })
      .catch(() => {
        if (!cancelled) setResult({ error: "Could not load today's specials." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/specials", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            name: item.name,
            description: item.description,
            price: item.price.trim() === "" ? null : item.price,
          })),
        }),
      });
      const data = await response.json().catch(() => ({ error: "Could not save specials." }));
      if (!response.ok) {
        if (data.needsConnection && typeof data.connectionCode === "string") setConnectCode(data.connectionCode);
        setResult({ error: data.error ?? "Could not save specials." });
        return;
      }
      setConnectCode("");
      setItems(fromServer(data.items ?? []));
      setResult({ ok: true, count: data.items?.length ?? 0 });
    } catch {
      setResult({ error: "Could not reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="specials-title">
      <h2 id="specials-title">Today's specials</h2>
      <p className="muted">Up to 3. These show on the public menu for today, and tomorrow starts blank.</p>
      {connectCode && (
        <div className="notice">
          <p>One-time step: send this connection code to your Cursor agent so the menu accepts specials from this dashboard. It is safe to share.</p>
          <code className="connect-code">{connectCode}</code>
        </div>
      )}
      <form onSubmit={onSubmit} className="specials-grid">
        {items.map((item, index) => (
          <fieldset key={index} className="special">
            <legend>Special {index + 1}</legend>
            <label>
              Name
              <input value={item.name} onChange={(event) => update(index, "name", event.target.value)} maxLength={80} />
            </label>
            <label>
              Description
              <input value={item.description} onChange={(event) => update(index, "description", event.target.value)} maxLength={160} />
            </label>
            <label>
              Price
              <input value={item.price} onChange={(event) => update(index, "price", event.target.value)} inputMode="decimal" placeholder="4.50" />
            </label>
          </fieldset>
        ))}
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save specials"}
        </button>
      </form>
      <div aria-live="polite">
        {result?.error && <p className="notice error">{result.error}</p>}
        {result?.ok && (
          <p className="notice ok">
            {result.count === 0 ? "Cleared today's specials on the menu." : `Updated the menu with ${result.count} special${result.count === 1 ? "" : "s"}.`}
          </p>
        )}
      </div>
    </section>
  );
}
