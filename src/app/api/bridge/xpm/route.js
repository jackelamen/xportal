import { NextResponse } from "next/server";
import { getDb, uuid } from "@/lib/db";
import { verifyBridgeSecret } from "@/lib/xpm-bridge";

// Inbound sync from xPM, authenticated by X-XPM-Bridge-Secret. Only top-level
// status fields cross the boundary — granular xPM tasks never reach the portal.
export async function POST(request) {
  if (!verifyBridgeSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  // Space transfer: an xPM space becomes (or refreshes) an xPortal client,
  // importing its projects in one idempotent call.
  if (body?.action === "space.link") return linkSpace(body);

  if (!body?.xpm_project_id) {
    return NextResponse.json({ error: "xpm_project_id is required" }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM portal_projects WHERE xpm_project_id = ?")
    .get(body.xpm_project_id);

  if (existing) {
    db.prepare(
      `UPDATE portal_projects SET
         current_phase = COALESCE(?, current_phase),
         progress_percentage = COALESCE(?, progress_percentage),
         target_date = COALESCE(?, target_date),
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      body.current_phase ?? null,
      body.progress_percentage ?? null,
      body.target_date ?? null,
      body.title ?? null,
      body.description ?? null,
      existing.id
    );
    syncHub(db, existing.id, body);
    return NextResponse.json({ ok: true, project_id: existing.id });
  }

  if (!body.client_email || !body.title) {
    return NextResponse.json(
      { error: "client_email and title are required to create a project" },
      { status: 400 }
    );
  }
  const client = db
    .prepare("SELECT id FROM clients WHERE primary_email = ?")
    .get(body.client_email.toLowerCase());
  if (!client) return NextResponse.json({ error: "Unknown client" }, { status: 404 });

  const id = uuid();
  db.prepare(
    `INSERT INTO portal_projects (id, xpm_project_id, client_id, title, current_phase, progress_percentage, target_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.xpm_project_id,
    client.id,
    body.title,
    body.current_phase || "Discovery",
    body.progress_percentage ?? 0,
    body.target_date ?? null
  );
  syncHub(db, id, body);
  return NextResponse.json({ ok: true, project_id: id }, { status: 201 });
}

// space.link payload:
//   { action: "space.link", xpm_space_id, space_name,
//     contacts: [{ name, email }],            -- first becomes primary
//     projects: [{ xpm_project_id, title, description?, current_phase?,
//                  progress_percentage?, target_date?, ...hub payloads }] }
// Idempotent: re-linking updates the client and upserts projects by
// xpm_project_id. Imported projects start hidden so operators curate what the
// client sees before anything goes live.
function linkSpace(body) {
  const { xpm_space_id, space_name, contacts = [], projects = [] } = body;
  if (!xpm_space_id || !space_name) {
    return NextResponse.json({ error: "xpm_space_id and space_name are required" }, { status: 400 });
  }
  const primary = contacts.find((c) => c?.email);
  const db = getDb();

  let client = db.prepare("SELECT * FROM clients WHERE xpm_space_id = ?").get(xpm_space_id);
  if (!client && primary) {
    // A client created manually with the same email gets linked, not duplicated.
    client = db.prepare("SELECT * FROM clients WHERE primary_email = ?").get(primary.email.toLowerCase());
  }

  if (client) {
    db.prepare("UPDATE clients SET company_name = ?, xpm_space_id = ? WHERE id = ?")
      .run(space_name, xpm_space_id, client.id);
  } else {
    if (!primary) {
      return NextResponse.json(
        { error: "At least one contact with an email is required to create a client" },
        { status: 400 }
      );
    }
    const id = uuid();
    db.prepare("INSERT INTO clients (id, company_name, primary_email, xpm_space_id) VALUES (?, ?, ?, ?)")
      .run(id, space_name, primary.email.toLowerCase(), xpm_space_id);
    client = { id };
  }

  for (const c of contacts) {
    if (!c?.email || !c?.name) continue;
    const email = c.email.toLowerCase();
    if (!db.prepare("SELECT id FROM client_users WHERE email = ?").get(email)) {
      db.prepare("INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)")
        .run(uuid(), client.id, c.name, email);
    }
  }

  const imported = [];
  for (const p of projects) {
    if (!p?.xpm_project_id || !p?.title) continue;
    const existing = db
      .prepare("SELECT id FROM portal_projects WHERE xpm_project_id = ?")
      .get(p.xpm_project_id);
    let projectId;
    if (existing) {
      projectId = existing.id;
      db.prepare(
        `UPDATE portal_projects SET
           client_id = ?, title = ?,
           description = COALESCE(?, description),
           current_phase = COALESCE(?, current_phase),
           progress_percentage = COALESCE(?, progress_percentage),
           target_date = COALESCE(?, target_date),
           updated_at = datetime('now')
         WHERE id = ?`
      ).run(client.id, p.title, p.description ?? null, p.current_phase ?? null,
        p.progress_percentage ?? null, p.target_date ?? null, projectId);
    } else {
      projectId = uuid();
      db.prepare(
        `INSERT INTO portal_projects
           (id, xpm_project_id, client_id, title, description, current_phase,
            progress_percentage, target_date, hidden_from_client)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(projectId, p.xpm_project_id, client.id, p.title, p.description ?? null,
        p.current_phase || "Discovery", p.progress_percentage ?? 0, p.target_date ?? null);
    }
    syncHub(db, projectId, p);
    imported.push({ xpm_project_id: p.xpm_project_id, project_id: projectId });
  }

  return NextResponse.json({
    ok: true,
    client_id: client.id,
    portal_url: `${process.env.APP_BASE_URL || ""}/admin/clients/${client.id}`,
    projects: imported,
  });
}

// Optional hub payloads from xPM:
//   kpis: [{ name, target_value?, current_value?, unit?, direction? }] (upsert by name)
//   working_items: ["..."] (replaces the active list)
//   decisions: [{ decided_on?, summary, recorded_by? }] (appends, deduped by summary)
function syncHub(db, projectId, body) {
  if (Array.isArray(body.kpis)) {
    for (const k of body.kpis) {
      if (!k?.name) continue;
      const existing = db
        .prepare("SELECT id FROM project_kpis WHERE project_id = ? AND name = ?")
        .get(projectId, k.name);
      if (existing) {
        db.prepare(
          `UPDATE project_kpis SET
             current_value = COALESCE(?, current_value),
             target_value = COALESCE(?, target_value),
             unit = COALESCE(?, unit),
             updated_at = datetime('now')
           WHERE id = ?`
        ).run(k.current_value ?? null, k.target_value ?? null, k.unit ?? null, existing.id);
      } else {
        db.prepare(
          `INSERT INTO project_kpis (id, project_id, name, target_value, current_value, unit, direction)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), projectId, k.name, k.target_value ?? null, k.current_value ?? null,
          k.unit ?? null, k.direction === "down" ? "down" : "up");
      }
    }
  }
  if (Array.isArray(body.working_items)) {
    db.prepare("UPDATE working_items SET status = 'done' WHERE project_id = ? AND status = 'active'")
      .run(projectId);
    for (const title of body.working_items) {
      if (typeof title === "string" && title.trim()) {
        db.prepare("INSERT INTO working_items (id, project_id, title) VALUES (?, ?, ?)")
          .run(uuid(), projectId, title.trim());
      }
    }
  }
  if (Array.isArray(body.decisions)) {
    for (const d of body.decisions) {
      if (!d?.summary) continue;
      const dupe = db
        .prepare("SELECT id FROM decision_log WHERE project_id = ? AND summary = ?")
        .get(projectId, d.summary);
      if (!dupe) {
        db.prepare(
          `INSERT INTO decision_log (id, project_id, decided_on, summary, recorded_by, source)
           VALUES (?, ?, ?, ?, ?, 'xpm')`
        ).run(uuid(), projectId, d.decided_on || new Date().toISOString().slice(0, 10),
          d.summary, d.recorded_by || "xPM");
      }
    }
  }
}
