import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Schema v2 — SQLite mirror of the Postgres target. UUIDs are generated
// app-side so rows port to Supabase unchanged. Bumping SCHEMA_VERSION
// recreates the dev database (Phase 2 gets real migrations instead).
const SCHEMA_VERSION = 4;

const SCHEMA = `
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  primary_email TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE,
  logo_path TEXT,
  accent_color TEXT,
  xpm_space_id TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE client_users (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE operator_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- user_type: 'client' (client_users.id) or 'operator' (operator_users.id)
CREATE TABLE login_tokens (
  id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE active_sessions (
  id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE portal_projects (
  id TEXT PRIMARY KEY,
  xpm_project_id TEXT UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  current_phase TEXT DEFAULT 'Discovery',
  progress_percentage INTEGER DEFAULT 0,
  target_date TEXT,
  hidden_from_client INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- direction: 'up' = higher is better, 'down' = lower is better
CREATE TABLE project_kpis (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_value REAL,
  current_value REAL,
  unit TEXT,
  direction TEXT NOT NULL DEFAULT 'up',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Standing documents, distinct from approval deliverables.
-- category: contract | agreement | reference | brand | report
-- kind: 'file' (asset_path under uploads/) or 'link'
CREATE TABLE project_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'reference',
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file',
  asset_path TEXT NOT NULL,
  original_name TEXT,
  uploaded_by_type TEXT NOT NULL,
  uploaded_by_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE project_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL
);

-- side: 'operator' | 'client'
CREATE TABLE project_people (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT
);

-- Operator asks the client for a file; fulfillment creates a project_document.
CREATE TABLE file_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  document_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  fulfilled_at TEXT
);

-- source: manual | approval | xpm
CREATE TABLE decision_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  decided_on TEXT NOT NULL,
  summary TEXT NOT NULL,
  recorded_by TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now'))
);

-- "We're working on" items shown to the client; status: active | done
CREATE TABLE working_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Operator-only notes; project_id NULL = note about the client overall.
CREATE TABLE internal_notes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- kind 'phase' rows draw the status bar + timeline bars; 'milestone' rows are
-- point markers. status: done | active | blocked | upcoming
CREATE TABLE project_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'phase',
  starts_on TEXT,
  ends_on TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE deliverables_approvals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  feedback_notes TEXT,
  actioned_by TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  actioned_at TEXT
);

-- kind: 'file' (asset_path under uploads/) or 'link' (external URL)
CREATE TABLE deliverable_versions (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables_approvals(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'link',
  asset_path TEXT NOT NULL,
  original_name TEXT,
  note TEXT,
  viewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- invoice_id set => invoice-scoped thread (disputes); otherwise project chat
CREATE TABLE communication_threads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  invoice_id TEXT,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  message_content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,          -- client has read (operator-sent messages)
  operator_read INTEGER DEFAULT 0,    -- operator has read (client-sent messages)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'Unpaid',
  dispute_reason TEXT,
  stripe_payment_intent_id TEXT,
  issued_date TEXT NOT NULL,
  due_date TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_user_id TEXT REFERENCES client_users(id),
  starts_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  google_event_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE blackout_dates (
  id TEXT PRIMARY KEY,
  on_date TEXT NOT NULL,
  start_time TEXT,   -- NULL start+end = whole day blocked
  end_time TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 0 = Sunday … 6 = Saturday; the default bookable window per weekday
CREATE TABLE weekly_hours (
  weekday INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '17:00'
);

CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT,
  actor_type TEXT NOT NULL,
  actor_name TEXT,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

let db;

export function getDb() {
  if (!db) {
    const dbPath = process.env.DATABASE_URL || "./data/xportal.db";
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA foreign_keys = ON;");
    const { user_version } = db.prepare("PRAGMA user_version").get();
    if (user_version < SCHEMA_VERSION) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Database schema is outdated; run migrations before starting in production.");
      }
      recreate(db);
    }
    // Lazily-added columns (no version bump, so the dev DB survives).
    ensureColumn(db, "clients", "xpm_space_id", "TEXT");
    ensureColumn(db, "portal_projects", "hidden_from_client", "INTEGER DEFAULT 0");
  }
  return db;
}

function ensureColumn(db, table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export const uuid = () => randomUUID();

function recreate(db) {
  db.exec("PRAGMA foreign_keys = OFF;");
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();
  for (const { name } of tables) db.exec(`DROP TABLE IF EXISTS "${name}"`);
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  db.exec("PRAGMA foreign_keys = ON;");
  seed(db);
}

function seed(db) {
  const clientId = uuid();
  db.prepare(
    "INSERT INTO clients (id, company_name, primary_email, slug, accent_color) VALUES (?, ?, ?, ?, ?)"
  ).run(clientId, "Acme Industries", "client@example.com", "acme", null);

  const userJane = uuid();
  db.prepare("INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)").run(
    userJane, clientId, "Jane Doe", "client@example.com"
  );
  db.prepare("INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)").run(
    uuid(), clientId, "Sam Lee", "sam@example.com"
  );

  db.prepare("INSERT INTO operator_users (id, name, email) VALUES (?, ?, ?)").run(
    uuid(), "Jack", "operator@example.com"
  );

  const p1 = uuid();
  const p2 = uuid();
  const proj = db.prepare(
    `INSERT INTO portal_projects (id, xpm_project_id, client_id, title, current_phase, progress_percentage, target_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  proj.run(p1, "XPM-1042", clientId, "Marketing Site Rebuild", "Design", 35, "2026-08-14");
  proj.run(p2, "XPM-1055", clientId, "Customer Dashboard v2", "Development", 60, "2026-09-30");
  db.prepare("UPDATE portal_projects SET description = ? WHERE id = ?").run(
    "Full rebuild of the acme.com marketing site: new information architecture, refreshed brand expression, CMS migration to a headless stack, and conversion-focused landing pages. Success = faster pages, clearer story, more demo requests.",
    p1
  );
  db.prepare("UPDATE portal_projects SET description = ? WHERE id = ?").run(
    "Version 2 of the customer-facing dashboard: realtime usage analytics, exportable reports, and role-based access. Replaces the legacy v1 dashboard before the Q4 renewal cycle.",
    p2
  );

  const kpi = db.prepare(
    `INSERT INTO project_kpis (id, project_id, name, target_value, current_value, unit, direction)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  kpi.run(uuid(), p1, "Page load time", 2.0, 2.4, "s", "down");
  kpi.run(uuid(), p1, "Demo requests / mo", 150, 118, "", "up");
  kpi.run(uuid(), p1, "Lighthouse score", 95, 88, "", "up");
  kpi.run(uuid(), p2, "Report export time", 5, 11, "s", "down");
  kpi.run(uuid(), p2, "Weekly active users", 400, 310, "", "up");

  const doc = db.prepare(
    `INSERT INTO project_documents (id, project_id, category, title, kind, asset_path, uploaded_by_type, uploaded_by_name)
     VALUES (?, ?, ?, ?, 'link', ?, ?, ?)`
  );
  doc.run(uuid(), p1, "contract", "Master services agreement", "https://docs.example.com/msa-acme", "operator", "Jack");
  doc.run(uuid(), p1, "agreement", "Mutual NDA (signed)", "https://docs.example.com/nda-acme", "operator", "Jack");
  doc.run(uuid(), p1, "reference", "Acme brand guidelines", "https://docs.example.com/acme-brand", "client", "Jane Doe");
  doc.run(uuid(), p2, "contract", "Dashboard v2 SOW", "https://docs.example.com/sow-dash", "operator", "Jack");

  const link = db.prepare("INSERT INTO project_links (id, project_id, label, url) VALUES (?, ?, ?, ?)");
  link.run(uuid(), p1, "Staging site", "https://staging.example.com");
  link.run(uuid(), p1, "Figma", "https://figma.com/file/acme-site");
  link.run(uuid(), p2, "Beta dashboard", "https://beta.example.com/dash");

  const person = db.prepare(
    "INSERT INTO project_people (id, project_id, side, name, role, email) VALUES (?, ?, ?, ?, ?, ?)"
  );
  person.run(uuid(), p1, "operator", "Jack", "Project lead", "operator@example.com");
  person.run(uuid(), p1, "client", "Jane Doe", "Marketing director", "client@example.com");
  person.run(uuid(), p2, "operator", "Jack", "Project lead", "operator@example.com");
  person.run(uuid(), p2, "client", "Sam Lee", "Product owner", "sam@example.com");

  db.prepare(
    "INSERT INTO file_requests (id, project_id, title, note) VALUES (?, ?, ?, ?)"
  ).run(uuid(), p1, "High-res logo pack", "We need vector source files (AI/SVG) for the new header.");

  const dec = db.prepare(
    "INSERT INTO decision_log (id, project_id, decided_on, summary, recorded_by, source) VALUES (?, ?, ?, ?, ?, ?)"
  );
  dec.run(uuid(), p1, "2026-05-28", "Switch CMS from WordPress to headless (Sanity)", "Jane Doe", "manual");
  dec.run(uuid(), p2, "2026-06-02", "Defer SSO integration to phase 2 of the dashboard", "Sam Lee", "manual");

  const wi = db.prepare("INSERT INTO working_items (id, project_id, title) VALUES (?, ?, ?)");
  wi.run(uuid(), p1, "Building the homepage hero and nav components");
  wi.run(uuid(), p1, "Migrating blog content into the new CMS");
  wi.run(uuid(), p2, "Implementing the realtime usage charts");

  db.prepare(
    "INSERT INTO internal_notes (id, client_id, project_id, author_name, content) VALUES (?, ?, ?, ?, ?)"
  ).run(uuid(), clientId, null, "Jack", "Renewal conversation due in September — budget owner is Jane, decisions go through her.");

  const ms = db.prepare(
    `INSERT INTO project_milestones (id, project_id, title, kind, starts_on, ends_on, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // Marketing Site Rebuild phases
  ms.run(uuid(), p1, "Discovery", "phase", "2026-05-04", "2026-05-22", "done", 0);
  ms.run(uuid(), p1, "Design", "phase", "2026-05-25", "2026-06-26", "active", 1);
  ms.run(uuid(), p1, "Development", "phase", "2026-06-29", "2026-07-24", "upcoming", 2);
  ms.run(uuid(), p1, "QA", "phase", "2026-07-27", "2026-08-07", "upcoming", 3);
  ms.run(uuid(), p1, "Launch", "phase", "2026-08-10", "2026-08-14", "upcoming", 4);
  ms.run(uuid(), p1, "Content freeze", "milestone", "2026-07-20", null, "upcoming", 5);
  // Customer Dashboard v2 phases
  ms.run(uuid(), p2, "Discovery", "phase", "2026-04-06", "2026-04-24", "done", 0);
  ms.run(uuid(), p2, "Design", "phase", "2026-04-27", "2026-05-29", "done", 1);
  ms.run(uuid(), p2, "Development", "phase", "2026-06-01", "2026-08-21", "active", 2);
  ms.run(uuid(), p2, "QA", "phase", "2026-08-24", "2026-09-18", "upcoming", 3);
  ms.run(uuid(), p2, "Launch", "phase", "2026-09-21", "2026-09-30", "upcoming", 4);
  ms.run(uuid(), p2, "Beta access opens", "milestone", "2026-08-24", null, "upcoming", 5);

  const d1 = uuid();
  const d2 = uuid();
  const d3 = uuid();
  const del = db.prepare(
    "INSERT INTO deliverables_approvals (id, project_id, title, status) VALUES (?, ?, ?, ?)"
  );
  del.run(d1, p1, "Homepage concept", "Pending");
  del.run(d2, p1, "Brand color exploration", "Approved");
  del.run(d3, p2, "Dashboard wireframes", "Pending");

  const ver = db.prepare(
    `INSERT INTO deliverable_versions (id, deliverable_id, version_no, kind, asset_path, original_name, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  ver.run(uuid(), d1, 1, "link", "https://staging.example.com/home-v1", null, "First pass");
  ver.run(uuid(), d1, 2, "link", "https://staging.example.com/home-v2", null, "Tightened hero + nav per kickoff notes");
  ver.run(uuid(), d2, 1, "link", "https://staging.example.com/brand-colors", null, null);
  ver.run(uuid(), d3, 1, "link", "https://staging.example.com/dash-wires", null, null);

  const msg = db.prepare(
    `INSERT INTO communication_threads (id, project_id, sender_type, sender_name, message_content, is_read, operator_read)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  msg.run(uuid(), p1, "Internal_Operator", "Jack", "Homepage concept v2 is up for review — let us know what you think.", 0, 1);
  msg.run(uuid(), p2, "Client", "Jane Doe", "Can we add a CSV export to the reports view?", 1, 0);

  const inv = db.prepare(
    `INSERT INTO invoices (id, project_id, invoice_number, amount, status, issued_date, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  inv.run(uuid(), p1, "INV-2026-014", 4800.0, "Paid", "2026-05-01", "2026-05-15");
  inv.run(uuid(), p1, "INV-2026-019", 3200.0, "Unpaid", "2026-06-01", "2026-06-15");
  inv.run(uuid(), p2, "INV-2026-021", 7500.0, "Unpaid", "2026-06-05", "2026-06-19");

  const act = db.prepare(
    `INSERT INTO activity_log (id, client_id, project_id, actor_type, actor_name, event_type, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  act.run(uuid(), clientId, p1, "operator", "Jack", "deliverable.submitted", "Homepage concept v2 submitted for review");
  act.run(uuid(), clientId, p1, "operator", "Jack", "invoice.issued", "Invoice INV-2026-019 issued ($3,200.00)");
}
