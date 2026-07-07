import { sql, uuid } from "./db";

// Server-side writers that turn a parsed CSV (see lib/csv.js) into project rows.
// The KPI / working / decision helpers are shared with the xPM bridge so the two
// ingestion paths stay in sync. Everything is additive and de-duplicated, so an
// import can be safely re-run.

// --- shared with the xPM bridge (behavior-preserving extraction of syncHub) ---

export async function upsertKpis(projectId, kpis) {
  if (!Array.isArray(kpis)) return;
  for (const k of kpis) {
    if (!k?.name) continue;
    // Boolean KPIs (kind: "boolean") only ever carry a 0/1/null reading;
    // target/unit/direction are numeric-only concepts and left null.
    const kind = k.kind === "boolean" ? "boolean" : "numeric";
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
        `INSERT INTO project_kpis (id, project_id, name, target_value, current_value, unit, direction, kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), projectId, k.name, kind === "boolean" ? null : (k.target_value ?? null), k.current_value ?? null,
          kind === "boolean" ? null : (k.unit ?? null), k.direction === "down" ? "down" : "up", kind]
      );
    }
  }
}

// Replace the active working list (used by the bridge). An empty array clears it.
export async function replaceWorkingItems(projectId, items) {
  if (!Array.isArray(items)) return;
  await sql("UPDATE working_items SET status = 'done' WHERE project_id = ? AND status = 'active'", [projectId]);
  for (const title of items) {
    if (typeof title === "string" && title.trim()) {
      await sql("INSERT INTO working_items (id, project_id, title) VALUES (?, ?, ?)",
        [uuid(), projectId, title.trim()]);
    }
  }
}

export async function appendDecisions(projectId, decisions, { recordedBy = "Import", source = "manual" } = {}) {
  if (!Array.isArray(decisions)) return;
  for (const d of decisions) {
    if (!d?.summary) continue;
    const dupe = (await sql(
      "SELECT id FROM decision_log WHERE project_id = ? AND summary = ?",
      [projectId, d.summary]
    ))[0];
    if (!dupe) {
      await sql(
        "INSERT INTO decision_log (id, project_id, decided_on, summary, recorded_by, source) VALUES (?, ?, ?, ?, ?, ?)",
        [uuid(), projectId, d.decided_on || new Date().toISOString().slice(0, 10),
          d.summary, d.recorded_by || recordedBy, source]
      );
    }
  }
}

// --- importer-only writers ---

async function nextSortOrder(projectId) {
  const row = (await sql(
    "SELECT COALESCE(MAX(sort_order), -1) AS mx FROM project_milestones WHERE project_id = ?",
    [projectId]
  ))[0];
  return (row?.mx ?? -1) + 1;
}

// Append phases, skipping titles that already exist, preserving file order.
export async function appendPhases(projectId, phases) {
  if (!phases?.length) return;
  const existing = await sql(
    "SELECT title FROM project_milestones WHERE project_id = ? AND kind = 'phase'", [projectId]
  );
  const have = new Set(existing.map((r) => r.title.toLowerCase()));
  let order = await nextSortOrder(projectId);
  for (const p of phases) {
    if (have.has(p.title.toLowerCase())) continue;
    have.add(p.title.toLowerCase());
    await sql(
      `INSERT INTO project_milestones (id, project_id, title, kind, starts_on, ends_on, status, sort_order)
       VALUES (?, ?, ?, 'phase', ?, ?, ?, ?)`,
      [uuid(), projectId, p.title, p.starts_on ?? null, p.ends_on ?? null, p.status || "upcoming", order++]
    );
  }
}

export async function appendMilestones(projectId, milestones) {
  if (!milestones?.length) return;
  let order = await nextSortOrder(projectId);
  for (const m of milestones) {
    await sql(
      `INSERT INTO project_milestones (id, project_id, title, kind, starts_on, ends_on, status, sort_order)
       VALUES (?, ?, ?, 'milestone', ?, ?, ?, ?)`,
      [uuid(), projectId, m.title, m.starts_on ?? null, null, m.status || "upcoming", order++]
    );
  }
}

export async function addLinks(projectId, links) {
  if (!links?.length) return;
  const existing = await sql("SELECT url FROM project_links WHERE project_id = ?", [projectId]);
  const have = new Set(existing.map((r) => r.url));
  for (const l of links) {
    if (have.has(l.url)) continue;
    have.add(l.url);
    await sql("INSERT INTO project_links (id, project_id, label, url) VALUES (?, ?, ?, ?)",
      [uuid(), projectId, l.label, l.url]);
  }
}

export async function addPeople(projectId, people) {
  if (!people?.length) return;
  const existing = await sql("SELECT name, side FROM project_people WHERE project_id = ?", [projectId]);
  const key = (n, s) => `${String(n).toLowerCase()}|${s}`;
  const have = new Set(existing.map((r) => key(r.name, r.side)));
  for (const p of people) {
    if (have.has(key(p.name, p.side))) continue;
    have.add(key(p.name, p.side));
    await sql("INSERT INTO project_people (id, project_id, side, name, role, email) VALUES (?, ?, ?, ?, ?, ?)",
      [uuid(), projectId, p.side, p.name, p.role ?? null, p.email ?? null]);
  }
}

// Append working items (importer semantics - unlike the bridge's replace), skipping
// titles already active so a re-import doesn't duplicate them.
export async function addWorkingItems(projectId, items) {
  if (!items?.length) return;
  const existing = await sql(
    "SELECT title FROM working_items WHERE project_id = ? AND status = 'active'", [projectId]
  );
  const have = new Set(existing.map((r) => r.title.toLowerCase()));
  for (const title of items) {
    const t = String(title || "").trim();
    if (!t || have.has(t.toLowerCase())) continue;
    have.add(t.toLowerCase());
    await sql("INSERT INTO working_items (id, project_id, title) VALUES (?, ?, ?)", [uuid(), projectId, t]);
  }
}

// Set only the project core fields the CSV actually provided; leave the rest.
export async function setProjectCore(projectId, project = {}) {
  const sets = [];
  const vals = [];
  if (project.title) { sets.push("title = ?"); vals.push(project.title); }
  if (project.description !== undefined) { sets.push("description = ?"); vals.push(project.description || null); }
  if (project.target_date !== undefined) { sets.push("target_date = ?"); vals.push(project.target_date || null); }
  if (project.progress !== undefined) { sets.push("progress_percentage = ?"); vals.push(project.progress); }
  if (sets.length === 0) return;
  sets.push("updated_at = NOW()");
  vals.push(projectId);
  await sql(`UPDATE portal_projects SET ${sets.join(", ")} WHERE id = ?`, vals);
}

// Apply a fully-parsed import to an existing project row.
export async function importProjectData(projectId, data, { recordedBy } = {}) {
  await setProjectCore(projectId, data.project || {});
  await appendPhases(projectId, data.phases);
  await appendMilestones(projectId, data.milestones);
  await upsertKpis(projectId, data.kpis);
  await addLinks(projectId, data.links);
  await addPeople(projectId, data.people);
  await addWorkingItems(projectId, data.working);
  await appendDecisions(projectId, data.decisions, { recordedBy: recordedBy || "Import" });

  // current_phase = the first active phase (the dropdown/status bar reads this).
  const active = (await sql(
    "SELECT title FROM project_milestones WHERE project_id = ? AND kind = 'phase' AND status = 'active' ORDER BY sort_order LIMIT 1",
    [projectId]
  ))[0];
  if (active) {
    await sql("UPDATE portal_projects SET current_phase = ?, updated_at = NOW() WHERE id = ?", [active.title, projectId]);
  }
}
