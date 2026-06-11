import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { verifyBridgeSecret } from "@/lib/xpm-bridge";

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
async function syncHub(projectId, body) {
  if (Array.isArray(body.kpis)) {
    for (const k of body.kpis) {
      if (!k?.name) continue;
      const existing = (await sql(
        "SELECT id FROM project_kpis WHERE project_id = ? AND name = ?",
        [projectId, k.name]
      ))[0];
      if (existing) {
        await sql(
          `UPDATE project_kpis SET
             current_value = COALESCE(?, current_value),
             target_value = COALESCE(?, target_value),
             unit = COALESCE(?, unit),
             updated_at = NOW()
           WHERE id = ?`,
          [k.current_value ?? null, k.target_value ?? null, k.unit ?? null, existing.id]
        );
      } else {
        await sql(
          `INSERT INTO project_kpis (id, project_id, name, target_value, current_value, unit, direction)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuid(), projectId, k.name, k.target_value ?? null, k.current_value ?? null,
            k.unit ?? null, k.direction === "down" ? "down" : "up"]
        );
      }
    }
  }
  if (Array.isArray(body.working_items)) {
    await sql("UPDATE working_items SET status = 'done' WHERE project_id = ? AND status = 'active'", [projectId]);
    for (const title of body.working_items) {
      if (typeof title === "string" && title.trim()) {
        await sql("INSERT INTO working_items (id, project_id, title) VALUES (?, ?, ?)",
          [uuid(), projectId, title.trim()]);
      }
    }
  }
  if (Array.isArray(body.decisions)) {
    for (const d of body.decisions) {
      if (!d?.summary) continue;
      const dupe = (await sql(
        "SELECT id FROM decision_log WHERE project_id = ? AND summary = ?",
        [projectId, d.summary]
      ))[0];
      if (!dupe) {
        await sql(
          "INSERT INTO decision_log (id, project_id, decided_on, summary, recorded_by, source) VALUES (?, ?, ?, ?, ?, 'xpm')",
          [uuid(), projectId, d.decided_on || new Date().toISOString().slice(0, 10),
            d.summary, d.recorded_by || "xPM"]
        );
      }
    }
  }
}
