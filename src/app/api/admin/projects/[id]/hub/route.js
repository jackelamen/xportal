import { getDb, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";

// Project-hub management. _action:
//   description | add_kpi | update_kpi | delete_kpi | add_link | delete_link
//   add_person | delete_person | add_decision | update_decision | delete_decision
//   add_working | update_working | finish_working | reopen_working | delete_working
//   create_file_request | add_note | update_note | delete_note
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const db = getDb();
  const project = db.prepare("SELECT * FROM portal_projects WHERE id = ?").get(id);
  if (!project) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const action = form.get("_action");
  const str = (k) => String(form.get(k) || "").trim();
  const num = (k) => (form.get(k) === null || str(k) === "" ? null : Number(form.get(k)));

  switch (action) {
    case "description":
      db.prepare("UPDATE portal_projects SET description = ?, updated_at = datetime('now') WHERE id = ?")
        .run(str("description") || null, id);
      break;

    case "add_kpi": {
      if (!str("name")) return new Response("KPI name required", { status: 400 });
      db.prepare(
        `INSERT INTO project_kpis (id, project_id, name, target_value, current_value, unit, direction)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(uuid(), id, str("name"), num("target_value"), num("current_value"), str("unit") || null,
        form.get("direction") === "down" ? "down" : "up");
      break;
    }
    case "update_kpi":
      db.prepare(
        "UPDATE project_kpis SET current_value = ?, updated_at = datetime('now') WHERE id = ? AND project_id = ?"
      ).run(num("current_value"), str("kpi_id"), id);
      logActivity({
        clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
        eventType: "kpi.updated", summary: `KPI updated: ${str("kpi_name") || "value"} → ${str("current_value")}`,
      });
      break;
    case "delete_kpi":
      db.prepare("DELETE FROM project_kpis WHERE id = ? AND project_id = ?").run(str("kpi_id"), id);
      break;

    case "add_link":
      if (!str("label") || !/^https?:\/\//.test(str("url"))) {
        return new Response("Label and http(s) URL required", { status: 400 });
      }
      db.prepare("INSERT INTO project_links (id, project_id, label, url) VALUES (?, ?, ?, ?)")
        .run(uuid(), id, str("label"), str("url"));
      break;
    case "delete_link":
      db.prepare("DELETE FROM project_links WHERE id = ? AND project_id = ?").run(str("link_id"), id);
      break;

    case "add_person":
      if (!str("name")) return new Response("Name required", { status: 400 });
      db.prepare(
        "INSERT INTO project_people (id, project_id, side, name, role, email) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(uuid(), id, form.get("side") === "client" ? "client" : "operator",
        str("name"), str("role") || null, str("email") || null);
      break;
    case "delete_person":
      db.prepare("DELETE FROM project_people WHERE id = ? AND project_id = ?").run(str("person_id"), id);
      break;

    case "add_decision":
      if (!str("summary")) return new Response("Decision summary required", { status: 400 });
      db.prepare(
        `INSERT INTO decision_log (id, project_id, decided_on, summary, recorded_by, source)
         VALUES (?, ?, ?, ?, ?, 'manual')`
      ).run(uuid(), id, str("decided_on") || new Date().toISOString().slice(0, 10), str("summary"), operator.name);
      break;

    case "update_decision":
      if (!str("summary")) return new Response("Decision summary required", { status: 400 });
      db.prepare(
        "UPDATE decision_log SET summary = ?, decided_on = COALESCE(NULLIF(?, ''), decided_on) WHERE id = ? AND project_id = ?"
      ).run(str("summary"), str("decided_on"), str("decision_id"), id);
      break;
    case "delete_decision":
      db.prepare("DELETE FROM decision_log WHERE id = ? AND project_id = ?").run(str("decision_id"), id);
      break;

    case "add_working":
      if (!str("title")) return new Response("Title required", { status: 400 });
      db.prepare("INSERT INTO working_items (id, project_id, title) VALUES (?, ?, ?)")
        .run(uuid(), id, str("title"));
      break;
    case "update_working":
      if (!str("title")) return new Response("Title required", { status: 400 });
      db.prepare("UPDATE working_items SET title = ? WHERE id = ? AND project_id = ?")
        .run(str("title"), str("item_id"), id);
      break;
    case "finish_working":
      db.prepare("UPDATE working_items SET status = 'done' WHERE id = ? AND project_id = ?")
        .run(str("item_id"), id);
      break;
    case "reopen_working":
      db.prepare("UPDATE working_items SET status = 'active' WHERE id = ? AND project_id = ?")
        .run(str("item_id"), id);
      break;
    case "delete_working":
      db.prepare("DELETE FROM working_items WHERE id = ? AND project_id = ?").run(str("item_id"), id);
      break;

    case "create_file_request": {
      if (!str("title")) return new Response("Title required", { status: 400 });
      db.prepare("INSERT INTO file_requests (id, project_id, title, note) VALUES (?, ?, ?, ?)")
        .run(uuid(), id, str("title"), str("note") || null);
      logActivity({
        clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
        eventType: "file_request.created", summary: `File requested from client: "${str("title")}"`,
      });
      await notifyClient(
        project.client_id,
        `We need a file from you: ${str("title")}`,
        `For ${project.title}: ${str("note") || str("title")}\n\nSign in to upload it.`
      );
      break;
    }

    case "add_note":
      if (!str("content")) return new Response("Note content required", { status: 400 });
      db.prepare(
        "INSERT INTO internal_notes (id, client_id, project_id, author_name, content) VALUES (?, ?, ?, ?, ?)"
      ).run(uuid(), project.client_id, id, operator.name, str("content"));
      break;
    case "update_note":
      if (!str("content")) return new Response("Note content required", { status: 400 });
      db.prepare("UPDATE internal_notes SET content = ? WHERE id = ? AND project_id = ?")
        .run(str("content"), str("note_id"), id);
      break;
    case "delete_note":
      db.prepare("DELETE FROM internal_notes WHERE id = ? AND project_id = ?").run(str("note_id"), id);
      break;

    default:
      return new Response("Unknown action", { status: 400 });
  }
  return redirectBack(request, form);
}
