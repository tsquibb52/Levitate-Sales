# Demo desk

A simple local sales demo tracker built with Next.js, React, TypeScript, and SQLite. Requires Node.js 24 or newer.

## Run locally

```sh
npm install
npm run seed
npm run dev
```

Open http://localhost:3000. `npm run seed` reads CSV files from `Call Logs/`; skip it if you do not have that folder. You can also add demos manually or import CSV / XLSX files inside the app.

For production mode: `npm run build`, then `npm start`. Both servers bind to the local computer. This first version has no login and is intended for local use.

## Data

- Persistent database: `data/demos.sqlite`. Database and raw call logs are excluded from Git.
- Back up the entire `data/` directory with the app stopped. CSV export contains the currently filtered demo records, but not history or transcripts.
- `lib/db.ts` creates relational tables for demos, change history, call logs, and seed import tracking. History references demos with a foreign key.
- The seed imports only `Demo Booked!` calls as demo records, deduplicated by phone call ID. It stores all call logs for reference, linked to records by company ID.
- Booking date, company, contact, phone, and source IDs come directly from the CSV. Scheduled dates, AE assignments, CRM links, and actual demo outcomes are left for review, rather than inferred from transcripts. “Demo Confirmed” does not mean “Showed.”
- Rerunning the seed preserves edits and does not restore deliberately deleted seeded records.
- Spreadsheet imports include column mapping, preview, and duplicate detection. Excel uses the first sheet. Dates support YYYY-MM-DD and MM/DD/YYYY; timestamps beginning YYYY-MM-DD use their date portion.
- Duplicate candidates use phone call ID, or company + contact + nonempty demo date. Repeated companies alone are allowed. Phone call IDs must be unique.
- Show rate is Showed / (Showed + No Show), excluding records dated in the future. Closed Won / Lost do not imply attendance.

SQLite keeps setup simple. A hosted deployment with multiple users would need authentication and a hosted database (such as Supabase/Postgres).

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The first version focuses on the editable table, search, combined filters, sorting, column selection, quick status changes, dashboard counts, imports, exports, duplication, and record history. Weekly charts and additional reporting can be added later.
