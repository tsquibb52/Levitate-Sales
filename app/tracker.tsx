"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { blankDemo, fields, localDate, metrics, safeLink, statuses } from "../lib/fields";
import type { Demo, DemoInput, Field, History, Call } from "../lib/fields";

const columns: { key: Field; label: string }[] = [
  { key: "demoDate", label: "Demo date" }, { key: "company", label: "Company" },
  { key: "contact", label: "Prospect" }, { key: "vertical", label: "Vertical" },
  { key: "crmLink", label: "Coffee / CRM" }, { key: "status", label: "Status" },
  { key: "ae", label: "AE" }, { key: "bookedDate", label: "Booked" }, { key: "notes", label: "Notes" },
  { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "location", label: "Location" }
];
const statusClass = (status: string) => ({ Showed: "green", "No Show": "red", Upcoming: "amber", Rescheduled: "blue", "Closed Won": "green", "Closed Lost": "red" }[status] || "gray");
const dateLabel = (value: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled";
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
const json = (method: string, value: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });

function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={ref} className={wide ? "modal wide" : "modal"} onCancel={e => { e.preventDefault(); close(); }}>
    <header className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={close} aria-label="Close dialog">✕</button></header>{children}
  </dialog>;
}

export default function Tracker() {
  const [demos, setDemos] = useState<Demo[]>([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [vertical, setVertical] = useState(""), [ae, setAe] = useState("");
  const [dateField, setDateField] = useState<"demoDate" | "bookedDate">("demoDate"), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [view, setView] = useState("all"), [sort, setSort] = useState<Field>("bookedDate"), [ascending, setAscending] = useState(false);
  const [visible, setVisible] = useState<string[]>(columns.slice(0, 9).map(c => c.key));
  const [editing, setEditing] = useState<Demo | DemoInput | null>(null), [importing, setImporting] = useState(false), [busyId, setBusyId] = useState("");
  async function refresh() { try { setDemos(await api("/api/demos")); } catch(e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); try { const saved = JSON.parse(localStorage.getItem("demo-columns") || "null"); if (Array.isArray(saved) && saved.length && saved.every(k => columns.some(c => c.key === k))) setVisible(saved); } catch {} }, []);
  function toggleColumn(key: string) { const next = visible.includes(key) ? visible.filter(k => k !== key) : [...visible, key]; if (!next.length) return; setVisible(next); localStorage.setItem("demo-columns", JSON.stringify(next)); }
  const stats = metrics(demos);
  const today = localDate();
  const filtered = useMemo(() => demos.filter(d =>
    (!search || `${d.company} ${d.contact}`.toLowerCase().includes(search.toLowerCase())) &&
    (!status || d.status === status) && (!vertical || d.vertical === vertical) && (!ae || d.ae === ae) &&
    (!from || d[dateField] >= from) && (!to || (!!d[dateField] && d[dateField] <= to)) &&
    (view !== "upcoming" || (["Upcoming", "Rescheduled"].includes(d.status) && d.demoDate >= today)) &&
    (view !== "review" || d.status === "Unknown / Needs Update")
  ).sort((a, b) => {
    if (!a[sort] && b[sort]) return 1; if (a[sort] && !b[sort]) return -1;
    return a[sort].localeCompare(b[sort]) * (ascending ? 1 : -1);
  }), [demos, search, status, vertical, ae, from, to, dateField, view, sort, ascending, today]);
  async function quickStatus(demo: Demo, next: string) {
    if (next === "Rescheduled") { setEditing({ ...demo, status: next }); return; }
    setBusyId(demo.id); setError("");
    try { const updated = await api(`/api/demos/${demo.id}`, json("PATCH", { status: next })); setDemos(ds => ds.map(d => d.id === demo.id ? updated : d)); setNotice("Status saved."); } catch(e) { setError((e as Error).message); } finally { setBusyId(""); }
  }
  function exportCsv() {
    const keys = ["id", ...fields.map(([k]) => k), "createdAt", "updatedAt"] as const;
    const quote = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const csv = [keys.join(","), ...filtered.map(d => keys.map(k => quote(d[k])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `demos-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  const activeColumns = columns.filter(c => visible.includes(c.key));
  return <>
    <nav className="topbar"><a className="brand" href="/"><span className="brand-mark">l</span> levitate <span className="brand-divider" /> <span className="workspace">Sales workspace</span></a><span className="local-pill"><i /> Local workspace</span></nav>
    <main>
      <div className="page-heading"><div><div className="eyebrow">SALES OPERATIONS</div><h1>Demo desk<span className="heading-dot">.</span></h1><p>Every booking. Every follow-up. All in one place.</p></div><div className="actions"><button onClick={() => setImporting(true)}>↑ Import</button><button className="primary" onClick={() => setEditing({ ...blankDemo(), bookedDate: today, status: "Upcoming" })}>＋ Add demo</button></div></div>
      <section className="stats" aria-label="Demo overview">
        {[['Total demos', stats.total, 'All your bookings'], ['Upcoming', stats.upcoming, 'Scheduled from today'], ['Showed', stats.shows, `${stats.noShows} no shows`], ['Show rate', stats.showRate === null ? '—' : `${stats.showRate}%`, 'Shows ÷ (shows + no shows)'], ['Needs update', stats.needsUpdate, 'Outcomes to review']].map(([label, value, hint]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}
      </section>
      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
      <section className="table-card">
        <div className="table-top"><div className="tabs">{[['all', 'All demos', demos.length], ['upcoming', 'Upcoming', stats.upcoming], ['review', 'Needs update', stats.needsUpdate]].map(([key, label, count]) => <button key={key} className={view === key ? "tab active" : "tab"} onClick={() => setView(String(key))}>{label}<span>{count}</span></button>)}</div><div className="table-tools"><details className="column-picker"><summary>☷ Columns</summary><div>{columns.map(c => <label key={c.key}><input type="checkbox" checked={visible.includes(c.key)} onChange={() => toggleColumn(c.key)} />{c.label}</label>)}</div></details><button className="text-button" onClick={exportCsv}>↓ Export</button></div></div>
        <div className="filters"><input className="search" aria-label="Search company or prospect" placeholder="Search company or prospect…" value={search} onChange={e => setSearch(e.target.value)} />
          <select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select>
          <select aria-label="Filter vertical" value={vertical} onChange={e => setVertical(e.target.value)}><option value="">All verticals</option>{[...new Set(demos.map(d => d.vertical).filter(Boolean))].sort().map(s => <option key={s}>{s}</option>)}</select>
          <select aria-label="Filter AE" value={ae} onChange={e => setAe(e.target.value)}><option value="">All AEs</option>{[...new Set(demos.map(d => d.ae).filter(Boolean))].sort().map(s => <option key={s}>{s}</option>)}</select>
          <details className="date-picker"><summary>Date range{from || to ? " •" : ""}</summary><div><label>Date type<select value={dateField} onChange={e => setDateField(e.target.value as typeof dateField)}><option value="demoDate">Demo date</option><option value="bookedDate">Booked date</option></select></label><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label></div></details>
          {(search || status || vertical || ae || from || to || view !== "all") && <button className="text-button" onClick={() => { setSearch(""); setStatus(""); setVertical(""); setAe(""); setFrom(""); setTo(""); setView("all"); }}>Clear filters</button>}
        </div>
        <div className="table-scroll"><table><thead><tr>{activeColumns.map(c => <th key={c.key} aria-sort={sort === c.key ? ascending ? "ascending" : "descending" : "none"}><button onClick={() => { if (sort === c.key) setAscending(!ascending); else { setSort(c.key); setAscending(true); } }}>{c.label}<span>{sort === c.key ? ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
          <tbody>{filtered.map(d => <tr key={d.id} onClick={() => setEditing(d)}>{activeColumns.map(c => <td key={c.key} className={`cell-${c.key}`}>
            {c.key === "company" ? <button className="company-button" onClick={e => { e.stopPropagation(); setEditing(d); }}><span className="company-avatar">{d.company.slice(0, 1).toUpperCase()}</span><span>{d.company}</span></button>
              : c.key === "status" ? <select className={`status ${statusClass(d.status)}`} aria-label={`Status for ${d.company}`} value={d.status} disabled={busyId === d.id} onClick={e => e.stopPropagation()} onChange={e => void quickStatus(d, e.target.value)}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
              : c.key === "crmLink" ? safeLink(d.crmLink) ? <a href={safeLink(d.crmLink)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Open lead ↗</a> : <span className="muted">—</span>
              : c.key === "demoDate" ? <span className={!d.demoDate ? "muted" : ""}>{dateLabel(d.demoDate)}{d.demoTime && <small className="cell-sub">{d.demoTime} {d.timeZone}</small>}</span>
              : c.key === "bookedDate" ? <span>{d.bookedDate ? dateLabel(d.bookedDate) : "—"}</span>
              : c.key === "notes" ? <span className="truncated" title={d.notes}>{d.notes || "—"}</span>
              : <span className={!d[c.key] ? "muted" : ""}>{d[c.key] || "—"}</span>}
          </td>)}</tr>)}</tbody></table>
          {loading ? <div className="empty">Loading your demos…</div> : !filtered.length && <div className="empty"><strong>{demos.length ? "No demos match these filters" : "Your demo desk is ready"}</strong><p>{demos.length ? "Try a different search or clear your filters." : "Add a demo or import a spreadsheet to get started."}</p></div>}
        </div>
        <footer className="table-footer"><span>{filtered.length} of {demos.length} demos</span><span>Click a company to edit · Change status right in the table</span></footer>
      </section>
      <p className="footnote">Saved on this computer. Imported call logs stay attached for reference; missing meeting details are yours to fill in.</p>
    </main>
    {editing && <Editor initial={editing} close={() => setEditing(null)} saved={async message => { setEditing(null); setNotice(message); await refresh(); }} duplicate={value => setEditing(value)} />}
    {importing && <Importer close={() => setImporting(false)} saved={async message => { setImporting(false); setNotice(message); await refresh(); }} />}
  </>;
}

function Editor({ initial, close, saved, duplicate }: { initial: Demo | DemoInput; close: () => void; saved: (message: string) => Promise<void>; duplicate: (value: DemoInput) => void }) {
  const [draft, setDraft] = useState(initial), [history, setHistory] = useState<History[]>([]), [calls, setCalls] = useState<Call[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [tab, setTab] = useState("details"), [confirmDelete, setConfirmDelete] = useState(false);
  const id = "id" in initial ? initial.id : null;
  useEffect(() => { setDraft(initial); setHistory([]); setCalls([]); setTab("details"); setConfirmDelete(false); setError(""); if (id) api(`/api/demos/${id}`).then(data => { setHistory(data.history); setCalls(data.calls); }).catch(e => setError(e.message)); }, [initial, id]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  function tryClose() { if (!busy && (!dirty || window.confirm("Discard your unsaved changes?"))) close(); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(id ? `/api/demos/${id}` : "/api/demos", json(id ? "PATCH" : "POST", draft)); await saved(id ? "Demo updated." : "Demo created."); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title={id ? initial.company : "New demo"} close={tryClose} wide>
    <div className="editor-tabs"><button className={tab === "details" ? "selected" : ""} onClick={() => setTab("details")}>Details</button><button className={tab === "calls" ? "selected" : ""} onClick={() => setTab("calls")}>Call logs <span>{calls.length}</span></button><button className={tab === "history" ? "selected" : ""} onClick={() => setTab("history")}>History <span>{history.length}</span></button></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <div className="modal-body" hidden={tab !== "details"}>
        {draft.status === "Rescheduled" && <div className="info">Set the new demo date and time below. The previous schedule will remain in History.</div>}
        <div className="form-grid">{fields.map(([key, label, type]) => <label className={type === "textarea" ? "full" : ""} key={key}>{label}{key === "company" && <span className="required"> *</span>}
          {type === "select" ? <select value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
            : type === "textarea" ? <textarea rows={3} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
            : <input required={key === "company"} type={type} value={draft[key]} placeholder={type === "url" ? "https://" : key === "timeZone" ? "e.g. America/Toronto" : ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}
        </label>)}</div>
        {"createdAt" in initial && <div className="timestamps">Created {new Date(initial.createdAt).toLocaleString()}<br />Last updated {new Date(initial.updatedAt).toLocaleString()}</div>}
      </div>
      <div className="modal-body" hidden={tab !== "calls"}><p className="section-description">Calls associated with this company. Repeated calls may refer to different meetings; review the transcript before updating this demo.</p>{calls.length ? calls.map(call => <details className="call" key={call.id}><summary><strong>{call.outcome}</strong><span>{call.calledAt} · {call.contact}</span></summary><p className="call-source">Source: {call.source}</p><pre>{call.transcript || "No transcript available."}</pre></details>) : <div className="empty">No call logs attached.</div>}</div>
      <div className="modal-body" hidden={tab !== "history"}>{history.length ? history.map(item => <article className="history-item" key={item.id}><strong>{item.action}</strong><time>{new Date(item.createdAt).toLocaleString()}</time>{item.field && <p><span className="old-value">{item.oldValue || "Empty"}</span> → <span>{item.newValue || "Empty"}</span></p>}</article>) : <div className="empty">Changes will appear here after saving.</div>}</div>
      <footer className="modal-footer"><div className="actions">{id && <><button type="button" className="danger text-button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</button><button type="button" disabled={busy} onClick={() => { const copy = { ...blankDemo(), ...draft, phoneCallId: "" }; const clean = Object.fromEntries(fields.map(([k]) => [k, copy[k]])) as DemoInput; duplicate(clean); }}>Duplicate</button></>}</div><div className="actions"><button type="button" onClick={tryClose} disabled={busy}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Save demo"}</button></div></footer>
    </form>
    {confirmDelete && <div className="delete-confirm" role="alert"><p>Delete <strong>{initial.company}</strong> and its edit history? This cannot be undone.</p><div className="actions"><button disabled={busy} onClick={() => setConfirmDelete(false)}>Keep demo</button><button className="danger-button" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/demos/${id}`, { method: "DELETE" }); await saved("Demo deleted."); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }}>Delete permanently</button></div></div>}
  </Modal>;
}

const aliases: Record<string, Field> = { companyname: "company", firstname: "contact", prospect: "contact", contactname: "contact", phonenumber: "phone", creationdate: "bookedDate", demoperformdate: "demoDate", showstatus: "status", coffeelink: "crmLink" };
function Importer({ close, saved }: { close: () => void; saved: (message: string) => Promise<void> }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]), [headers, setHeaders] = useState<string[]>([]), [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<(DemoInput & { duplicate: boolean })[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [skip, setSkip] = useState(true), [bookingsOnly, setBookingsOnly] = useState(true);
  const isCallLog = headers.includes("Outcome") && headers.includes("PhoneCallId");
  const source = isCallLog && bookingsOnly ? rows.filter(r => r.Outcome === "Demo Booked!") : rows;
  async function upload(file?: File) {
    if (!file) return; setBusy(true); setError(""); setPreview([]);
    try { const form = new FormData(); form.append("file", file); const data = await api("/api/import", { method: "POST", body: form }); setRows(data.rows); setHeaders(data.headers);
      const next: Record<string, string> = {};
      for (const h of data.headers as string[]) { const normalized = h.toLowerCase().replace(/[^a-z]/g, ""); const match = fields.find(([key, label]) => [key, label].some(s => s.toLowerCase().replace(/[^a-z]/g, "") === normalized)); const key = match?.[0] || aliases[normalized]; if (key) next[key] = h; }
      setMapping(next);
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function buildPreview() {
    setBusy(true); setError("");
    try {
      const mapped = source.map(row => {
        const result = blankDemo();
        for (const [key] of fields) if (mapping[key]) result[key] = row[mapping[key]] || "";
        if (mapping.contact === "FirstName" && row.LastName) result.contact += ` ${row.LastName}`;
        for (const key of ["demoDate", "bookedDate"] as const) if (result[key]) {
          const value = result[key].trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(value)) result[key] = value.slice(0, 10);
          else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) { const [m,d,y] = value.split("/"); result[key] = `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`; }
        }
        const matchedStatus = statuses.find(s => s.toLowerCase() === result.status.toLowerCase());
        if (matchedStatus) result.status = matchedStatus;
        return result;
      });
      setPreview((await api("/api/import", json("POST", { rows: mapped }))).preview);
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Import demos" close={() => { if (!busy) close(); }} wide><div className="modal-body">
    <p className="section-description">Upload a CSV or Excel (.xlsx), match your columns, then review before saving. Dates accept YYYY-MM-DD or MM/DD/YYYY. Excel imports the first sheet.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    {!preview.length ? <><label className="upload">Choose spreadsheet<input type="file" accept=".csv,.xlsx" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>
      {!!rows.length && <><p><strong>{rows.length} rows</strong> found. Unmapped fields will be left blank.</p>{isCallLog && <label className="check-label"><input type="checkbox" checked={bookingsOnly} onChange={e => setBookingsOnly(e.target.checked)} />Import only “Demo Booked!” calls ({source.length} selected)</label>}
      <div className="form-grid mapping">{fields.map(([key, label]) => <label key={key}>{label}<select value={mapping[key] || ""} onChange={e => setMapping({ ...mapping, [key]: e.target.value })}><option value="">Do not import</option>{headers.map(h => <option key={h}>{h}</option>)}</select></label>)}</div></>}
    </> : <><div className="info">{preview.length} demos ready for review · {preview.filter(r => r.duplicate).length} possible duplicates</div><label className="check-label"><input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} />Skip possible duplicates</label><p className="section-description">Matches use phone call ID, or company + contact + demo date. Repeated company names alone are allowed. A phone call ID must always be unique.</p><div className="import-preview"><table><thead><tr><th>Company</th><th>Prospect</th><th>Demo date</th><th>Status</th><th>Review</th></tr></thead><tbody>{preview.map((r,i) => <tr key={i}><td>{r.company}</td><td>{r.contact}</td><td>{r.demoDate || "—"}</td><td>{r.status}</td><td>{r.duplicate ? "Possible duplicate" : "New"}</td></tr>)}</tbody></table></div></>}
    </div><footer className="modal-footer"><button disabled={busy} onClick={() => preview.length ? setPreview([]) : close()}>{preview.length ? "Back to mapping" : "Cancel"}</button><button className="primary" disabled={busy || !source.length || !mapping.company} onClick={async () => {
      if (!preview.length) { await buildPreview(); return; }
      setBusy(true); setError("");
      try { const result = await api("/api/import", json("POST", { rows: preview, confirm: true, skipDuplicates: skip })); await saved(`Imported ${result.imported} demos. Skipped ${result.skipped} duplicates.`); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>{busy ? "Working…" : preview.length ? "Confirm import" : "Preview import"}</button></footer></Modal>;
}
