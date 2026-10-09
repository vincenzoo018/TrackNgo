# TrackNgo — What's Still Lacking

_Checked: October 7, 2026 · Compared against ARTA rules, the Local Government Code, and existing LGU systems._

---

## 1. Pages that only show sample data

These look finished but don't save or load real data. Finish them or hide them before the defense.

| Page | Problem |
|---|---|
| Admin → Templates | Fake cards; edit/delete only show an alert |
| Admin → System Configuration | Uses sample data. No screen to add/edit **document types** or their **ARTA days** |
| HR → Leave | 6 hardcoded leave requests, nothing is saved |
| Receiving → Location Map | Always shows document TNG-2026-0004 |
| Receiving → ARTA Timeline | Always shows document TNG-2026-0004 |

---

## 2. Missing processes

### A. ARTA / legal compliance — most important

| # | What to add | Why |
|---|---|---|
| 1 | **Holiday calendar** | ARTA deadlines skip weekends but not holidays or work suspensions, so due dates come out wrong |
| 2 | **Requirements checklist + "incomplete" notice** | Under RA 11032 the clock starts only when requirements are complete; the client gets one written notice of what's missing |
| 3 | **One-time extension + "deemed approved"** | An office may extend once, with written notice. If it misses the deadline with no notice, the request is automatically approved |
| 4 | **Citizen's Charter per document type** | Each type needs its requirements, steps, fees, and category: Simple (3 days), Complex (7), Highly Technical (20). The seeded days (5, 10, 15) don't match |
| 5 | **Client satisfaction survey (CSM)** | Required by ARTA. Send it via tracking page / QR / SMS after release, plus a CSM report |
| 6 | **Data privacy notice + consent** | Intake collects names, addresses, IDs and mobile numbers but never asks for consent (RA 10173) |

### B. Mayor's office processes

| # | What to add | Why |
|---|---|---|
| 7 | **Ordinance / resolution approve-or-veto** | The city mayor has **10 days** to sign or veto; after that it is deemed approved (LGC Sec. 54). The "Ordinance" type is set to 15 days |
| 8 | **Officer-in-Charge / Acting Mayor** | When the Mayor is on leave or traveling, documents stall. Law allows an acting mayor or a written OIC designation (LGC Sec. 46). Same issue for department heads |
| 9 | **Outgoing issuances log + numbering** | Executive Orders and memos need official numbers like "EO No. 12, s. 2026", not just tracking numbers. Outgoing letters need a "received by" record |
| 10 | **Standard routing instructions** | LGU routing slips use *For appropriate action / For signature / For comment / For file*, each with a due date. Ours only has Forward / Endorse / Return / Approve |
| 11 | **72-hour complaint handling** | "Complaint / Grievance" exists but follows the normal clock; 8888 rules require action within 72 hours |
| 12 | **Mayor's Action Center requests** | Assistance and courtesy-call requests exist but lack: Mayor's calendar, amount approved, hand-off to Accounting/Treasury, repeat-request check |
| 13 | **FOI requests** _(only if Mati has an FOI ordinance)_ | 15 working days to answer; appeal to the Mayor decided in 5 days |

### C. Records & system

| # | What to add | Why |
|---|---|---|
| 14 | **Retention + disposal of records** | Archived records need a keep-until date. Destroying public records needs National Archives approval (RA 9470) |
| 15 | **Physical location of paper originals** | Cabinet / box number of the hard copy (what Location Map was meant for) |
| 16 | **Database backup & restore** | All data is in one SQLite file; if it's lost, everything is gone |
| 17 | **Email notifications for staff** | Only SMS exists today |
| 18 | **PNPKI digital signature** _(future)_ | Current signatures are stamped images. DICT's PNPKI signatures are legally recognized (RA 8792) |

---

## 3. Do these first

1. Holiday calendar (#1)
2. Extension + deemed approved (#3)
3. Ordinance 10-day veto timer (#7)
4. OIC / Acting Mayor (#8)
5. Finish or hide the sample-data pages (Section 1)

---

## 4. Expect this defense question

> _"DILG launched DMS4LGUs in July 2026 for free. Why not just use that?"_

Prepare a comparison. TrackNgo's edge: **CART ARTA monitoring**, **SMS updates to citizens**, and **public tracking**.

---

### Laws referenced

- **RA 11032** — Ease of Doing Business / ARTA (3-7-20 days, extension, deemed approved, Citizen's Charter)
- **RA 7160** — Local Government Code (Sec. 46 acting mayor, Sec. 54 veto)
- **RA 10173** — Data Privacy Act
- **RA 9470** — National Archives Act (records disposal)
- **RA 8792** — E-Commerce Act (electronic signatures)
- **EO 6, s. 2016** — 8888 Citizens' Complaint Hotline (72-hour action)
