"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPanel({ hasData }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setResult({ error: "Choose a spreadsheet first." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json().catch(() => ({ error: "Something went wrong. Please try again." }));
      setResult(response.ok ? data : { error: data.error ?? "Upload failed." });
      if (response.ok) {
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setResult({ error: "Could not reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    if (!window.confirm("Delete all uploaded sales from this dashboard? This cannot be undone.")) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/sales", { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      setResult(response.ok ? { cleared: data.removed } : { error: data.error ?? "Could not delete sales." });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card upload" aria-labelledby="upload-title">
      <h2 id="upload-title">{hasData ? "Add or update sales" : "Upload your sales"}</h2>
      <p className="muted">
        Upload a .csv or .xlsx with a header row: <strong>Date, Item, Qty, Total</strong> (or Price). Uploading days you already have replaces
        those days, so it is safe to re-upload a corrected file.
      </p>
      <form onSubmit={onSubmit} className="upload-form">
        <input ref={inputRef} type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Sales spreadsheet" />
        <button type="submit" disabled={busy}>
          {busy ? "Working..." : "Upload"}
        </button>
        <a href="/sample-sales.csv" download className="link">
          Download an example
        </a>
      </form>
      <div aria-live="polite">
        {result?.error && <p className="notice error">{result.error}</p>}
        {result?.ok && (
          <p className="notice ok">
            Added {result.added.toLocaleString()} sales lines
            {result.replaced > 0 ? ` (replaced ${result.replaced.toLocaleString()} existing lines for ${result.from} to ${result.to})` : ""}.
            {result.skipped > 0 && (
              <>
                {" "}
                Skipped {result.skipped} rows I could not read: {result.problems.join("; ")}
                {result.skipped > result.problems.length ? "; ..." : ""}.
              </>
            )}
          </p>
        )}
        {result?.cleared !== undefined && <p className="notice ok">Removed {result.cleared.toLocaleString()} sales lines.</p>}
      </div>
      {hasData && (
        <button type="button" className="danger" onClick={onClear} disabled={busy}>
          Delete all sales data
        </button>
      )}
    </section>
  );
}
