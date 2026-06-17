import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { verifyBridgeSecret } from "@/lib/xpm-bridge";
import { upsertKpis, replaceWorkingItems, appendDecisions } from "@/lib/project-import";

// Inbound sync from xPM, authenticated by X-XPM-Bridge-Secret. Only top-level
// status fields cross the boundary — granular xPM tasks never reach the portal.
export async function POST(request) {
  if (!verifyBridgeSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (body?.action === "space.link") return linkSpace(body);

  if (!body?.xpm_project_id) {
    return NextResponse.json({ error: "xpm_project_id is required" }, { status: 400 });
  }

  const existing = (await sql(
    "SELECT id FROM portal_projects WHERE xpm_project_id = ?",
    [body.xpm_project_id]
  ))[0];

  if (existing) {
    await sql(
      `UPDATE portal_projects SET
         current_phase = COALESCE(?, current_phase),
         progress_percentage = COALESCE(?, progress_percentage),
         target_date = COALESCE(?, target_date),
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         updated_at = NOW()
       WHERE id = ?`,
      [
        body.current_phase ?? null,
        body.progress_percentage ?? null,
        body.target_date ?? null,
        body.title ?? null,
        body.description ?? null,
        existing.id,
      ]
    );
    await syncHub(existing.id, body);
    return NextResponse.json({ ok: true, project_id: existing.id });
  }

  if (!body.client_email || !body.title) {
    return NextResponse.json(
      { error: "client_email and title are required to create a project" },
      { status: 400 }
    );
  }
  const client = (await sql(
    "SELECT id FROM clients WHERE primary_email = ?",
    [body.client_email.toLowerCase()]
  ))[0];
  if (!client) return NextResponse.json({ error: "Unknown client" }, { status: 404 });

  const id = uuid();
  await sql(
    `INSERT INTO portal_projects (id, xpm_project_id, client_id, title, current_phase, progress_percentage, target_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, body.xpm_project_id, client.id, body.title, body.current_phase || "Research",
      body.progress_percentage ?? 0, body.target_date ?? null]
  );
  await syncHub(id, body);
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
async function linkSpace(body) {
  const { xpm_space_id, space_name, contacts = [], projects = [] } = body;
  if (!xpm_space_id || !space_name) {
    return NextResponse.json({ error: "xpm_space_id and space_name are required" }, { status: 400 });
  }
  const primary = contacts.find((c) => c?.email);

  let client = (await sql("SELECT * FROM clients WHERE xpm_space_id = ?", [xpm_space_id]))[0];
  if (!client && primary) {
    client = (await sql("SELECT * FROM clients WHERE primary_email = ?", [primary.email.toLowerCase()]))[0];
  }

  if (client) {
    await sql("UPDATE clients SET company_name = ?, xpm_space_id = ? WHERE id = ?",
      [space_name, xpm_space_id, client.id]);
  } else {
    if (!primary) {
      return NextResponse.json(
        { error: "At least one contact with an email is required to create a client" },
        { status: 400 }
      );
    }
    const id = uuid();
    await sql("INSERT INTO clients (id, company_name, primary_email, xpm_space_id) VALUES (?, ?, ?, ?)",
      [id, space_name, primary.email.toLowerCase(), xpm_space_id]);
    client = { id };
  }

  for (const c of contacts) {
    if (!c?.email || !c?.name) continue;
    const email = c.email.toLowerCase();
    if (!(await sql("SELECT id FROM client_users WHERE email = ?", [email]))[0]) {
      await sql("INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)",
        [uuid(), client.id, c.name, email]);
    }
  }

  const imported = [];
  for (const p of projects) {
    if (!p?.xpm_project_id || !p?.title) continue;
    const existing = (await sql("SELECT id FROM portal_projects WHERE xpm_project_id = ?", [p.xpm_project_id]))[0];
    let projectId;
    if (existing) {
      projectId = existing.id;
      await sql(
        `UPDATE portal_projects SET
           client_id = ?, title = ?,
           description = COALESCE(?, description),
           current_phase = COALESCE(?, current_phase),
           progress_percentage = COALESCE(?, progress_percentage),
           target_date = COALESCE(?, target_date),
           updated_at = NOW()
         WHERE id = ?`,
        [client.id, p.title, p.description ?? null, p.current_phase ?? null,
          p.progress_percentage ?? null, p.target_date ?? null, projectId]
      );
    } else {
      projectId = uuid();
      await sql(
        `INSERT INTO portal_projects
           (id, xpm_project_id, client_id, title, description, current_phase,
            progress_percentage, target_date, hidden_from_client)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [projectId, p.xpm_project_id, client.id, p.title, p.description ?? null,
          p.current_phase || "Research", p.progress_percentage ?? 0, p.target_date ?? null]
      );
    }
    await syncHub(projectId, p);
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
// Shares its writers with the CSV importer — see lib/project-import.js.
async function syncHub(projectId, body) {
  await upsertKpis(projectId, body.kpis);
  await replaceWorkingItems(projectId, body.working_items);
  await appendDecisions(projectId, body.decisions, { recordedBy: "xPM", source: "xpm" });
}
