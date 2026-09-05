"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { isUpcoming, localDate, metrics, needsReview, safeLink, statuses, verticals } from "../lib/fields";
import type { Demo, DemoInput, Field } from "../lib/fields";

const displayFields: { key: Field | "schedule"; label: string; className?: string }[] = [
  { key: "company", label: "Company", className: "wide-cell" },
  { key: "contact", label: "Contact" },
  { key: "schedule", label: "Demo date / time", className: "wide-cell" },
  { key: "vertical", label: "Vertical" },
  { key: "status", label: "Status" }
];

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}

const json = (method: string, value: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });

export default function Tracker() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("all");
  const today = localDate();

  async function refresh() {
    try {
      setDemos(await api("/api/demos"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const stats = metrics(demos);
  const filtered = useMemo(() => demos.filter(d =>
    (!search || `${d.company} ${d.contact} ${d.vertical} ${d.status}`.toLowerCase().includes(search.toLowerCase())) &&
    (!status || d.status === status) &&
    (view !== "upcoming" || isUpcoming(d, today)) &&
    (view !== "review" || needsReview(d))
  ).sort((a, b) => {
    const aDate = a.demoDate || "9999-99-99";
    const bDate = b.demoDate || "9999-99-99";
    return aDate.localeCompare(bDate) || a.company.localeCompare(b.company);
  }), [demos, search, status, view, today]);

  async function saveField(id: string, value: Partial<DemoInput>) {
    setError("");
    try {
      const updated = await api(`/api/demos/${id}`, json("PATCH", value));
      setDemos(ds => ds.map(d => d.id === id ? updated : d));
      setNotice("Saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return <main>
    <div className="toolbar">
      <input className="search" aria-label="Search demos" placeholder="Search demos..." value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {statuses.map(s => <option key={s}>{s}</option>)}
      </select>
    </div>

    <section className="stats" aria-label="Demo overview">
      {[
        ["Total demos", stats.total, "All records"],
        ["Upcoming", stats.upcoming, "Scheduled from today"],
        ["Showed", stats.shows, `${stats.noShows} no shows`],
        ["Show rate", stats.showRate === null ? "-" : `${stats.showRate}%`, "Past demos only"],
        ["Needs update", stats.needsUpdate, "Missing details"]
      ].map(([label, value, hint]) => <button key={label} className={`stat ${view === label.toString().toLowerCase().split(" ")[0] ? "active" : ""}`} onClick={() => {
        if (label === "Upcoming") setView(view === "upcoming" ? "all" : "upcoming");
        else if (label === "Needs update") setView(view === "review" ? "all" : "review");
        else setView("all");
      }}><span>{label}</span><strong>{value}</strong><small>{hint}</small></button>)}
    </section>

    {error && <div className="alert error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}

    <section className="demo-list" aria-label="Demo list">
      <div className="list-head">
        <strong>{filtered.length} of {demos.length} demos</strong>
        {(search || status || view !== "all") && <button className="text-button" onClick={() => { setSearch(""); setStatus(""); setView("all"); }}>Clear filters</button>}
      </div>
      <div className="grid-scroll">
        <table>
          <thead><tr>{displayFields.map(field => <th className={field.className} key={field.key}>{field.label}</th>)}</tr></thead>
          <tbody>{filtered.map(demo => <EditableRow demo={demo} key={demo.id} save={saveField} />)}</tbody>
        </table>
        {loading ? <div className="empty">Loading demos...</div> : !filtered.length && <div className="empty">No demos match this view.</div>}
      </div>
    </section>
  </main>;
}

function EditableRow({ demo, save }: { demo: Demo; save: (id: string, value: Partial<DemoInput>) => Promise<void> }) {
  const [draft, setDraft] = useState(demo);
  const [saving, setSaving] = useState(false);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => { setDraft(demo); }, [demo]);

  async function commit(key: Field, value: string) {
    if (demo[key] === value) return;
    saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
      setSaving(true);
      await save(demo.id, { [key]: value });
      setSaving(false);
    });
    await saveQueue.current;
  }

  return <tr className={saving ? "saving" : ""}>
    {displayFields.map(field => <td className={field.className} key={field.key}>
      {field.key === "company" ? <span className="company-links">{leadLinkFor(draft) ? <a className="company-link" href={leadLinkFor(draft)} target="_blank" rel="noreferrer" aria-label={`Open lead for ${draft.company}`}>{draft.company}</a> : <span>{draft.company}</span>}{callLogLinkFor(draft) && <a className="recording-icon" href={callLogLinkFor(draft)} target="_blank" rel="noreferrer" aria-label={`Open recording for ${draft.company}`}>☕</a>}</span>
        : field.key === "schedule" ? <span className={!draft.demoDate ? "muted" : ""}>{formatSchedule(draft)}</span>
        : field.key === "vertical" ? <select className={`vertical ${verticalClass(draft.vertical)}`} aria-label={`Vertical for ${draft.company}`} value={draft.vertical} onChange={async e => {
          const next = { ...draft, vertical: e.target.value };
          setDraft(next);
          await commit("vertical", next.vertical);
        }}><option value="">Choose</option>{verticals.map(v => <option key={v}>{v}</option>)}</select>
        : field.key === "status" ? <select className={`status ${statusClass(draft.status)}`} aria-label={`Status for ${draft.company}`} value={draft.status} onChange={async e => {
          const next = { ...draft, status: e.target.value };
          setDraft(next);
          await commit("status", next.status);
        }}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
        : <span className={!draft[field.key] ? "muted" : ""}>{draft[field.key] || "-"}</span>}
    </td>)}
  </tr>;
}

const statusClass = (status: string) => ({ Showed: "green", "No Show": "red", Cancelled: "red", Upcoming: "amber", Tentative: "violet", Rescheduled: "blue", "Closed Won": "green", "Closed Lost": "red", Disqualified: "slate" }[status] || "gray");
const verticalClass = (vertical: string) => ({ Roofing: "roofing", HVAC: "hvac", Plumbing: "plumbing", Remodeling: "remodeling", Construction: "construction", Energy: "energy", Distributor: "distributor" }[vertical] || "other");
const leadLinkFor = (demo: DemoInput) => safeLink(demo.crmLink) || (demo.companyId ? `https://secure.coffee.inc/#/queue?from=CallLog&companyId=${encodeURIComponent(demo.companyId)}` : undefined);
const callLogLinkFor = (demo: DemoInput) => demo.phoneCallId ? `https://secure.coffee.inc/#/call-log/${encodeURIComponent(demo.phoneCallId)}` : undefined;
const formatDate = (value: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const formatTime = (value: string) => {
  if (!value) return "";
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
};
const formatSchedule = (demo: DemoInput) => demo.demoDate ? [formatDate(demo.demoDate), formatTime(demo.demoTime), demo.timeZone].filter(Boolean).join(" ") : "-";
