export const statuses = ["Upcoming", "No Show", "Performed"] as const;
export const verticals = ["HVAC", "Roofing", "Remodellers", "Plumbing", "Other"] as const;
export const fields = [
  ["company", "Company name", "text"], ["contact", "Prospect / contact", "text"],
  ["title", "Role / title", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"],
  ["website", "Company website", "url"], ["crmLink", "Coffee / CRM link", "url"],
  ["bookedDate", "Booked date", "date"], ["demoDate", "Demo date", "date"],
  ["demoTime", "Demo time", "time"], ["timeZone", "Time zone", "text"],
  ["vertical", "Vertical", "text"], ["subVertical", "Sub-vertical", "text"],
  ["location", "Location", "text"], ["ae", "AE / product specialist", "text"],
  ["status", "Status", "select"], ["notes", "Notes", "textarea"],
  ["qualificationNotes", "Qualification notes", "textarea"], ["meetingReason", "Why they took the meeting", "textarea"],
  ["currentSystem", "Current CRM / job software", "text"], ["databaseSize", "Database size", "text"],
  ["followUp", "Customer follow-up / KIT process", "textarea"], ["focus", "Growth vs. retention focus", "text"],
  ["companyId", "Company ID", "text"], ["phoneCallId", "Phone call ID", "text"]
] as const;
export type Field = typeof fields[number][0];
export type DemoInput = Record<Field, string>;
export type Demo = DemoInput & { id: string; createdAt: string; updatedAt: string };
export type History = { id: number; action: string; field: string | null; oldValue: string | null; newValue: string | null; createdAt: string };
export type Call = { id: string; companyId: string; company: string; contact: string; calledAt: string; outcome: string; transcript: string; source: string };
export function blankDemo(): DemoInput {
  return { ...Object.fromEntries(fields.map(([key]) => [key, ""])), status: "No Show" } as DemoInput;
}
export function safeLink(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function metrics(demos: Demo[]) {
  const today = localDate();
  const shows = demos.filter(d => d.status === "Performed" && (!d.demoDate || d.demoDate <= today)).length;
  const noShows = demos.filter(d => d.status === "No Show" && (!d.demoDate || d.demoDate <= today)).length;
  return { total: demos.length, upcoming: demos.filter(d => isUpcoming(d, today)).length,
    shows, noShows, showRate: shows + noShows ? Math.round(shows / (shows + noShows) * 100) : null,
    needsUpdate: demos.filter(needsReview).length };
}
export function isUpcoming(demo: DemoInput, today = localDate()) {
  return demo.status === "Upcoming" && demo.demoDate >= today;
}
export function needsReview(demo: DemoInput) {
  return false;
}
