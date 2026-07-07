import { sql, uuid } from "@/lib/db";
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
  const project = (await sql("SELECT * FROM portal_projects WHERE id = ?", [id]))[0];
  if (!project) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const action = form.get("_action");
  const str = (k) => String(form.get(k) || "").trim();
  const num = (k) => (form.get(k) === null || str(k) === "" ? null : Number(form.get(k)));

  switch (action) {
    case "description":
      await sql("UPDATE portal_projects SET description = ?, updated_at = NOW() WHERE id = ?", [
        str("description") || null, id,
      ]);
      break;

    case "add_kpi": {
      if (!str("name")) return new Response("KPI name required", { status: 400 });
      const kind = form.get("kind") === "boolean" ? "boolean" : "numeric";
      // Boolean KPIs only ever track a Yes/No/Pending reading - target,
      // unit, and direction are numeric-only concepts.
      await sql(
        `INSERT INTO project_kpis (id, project_id, name, target_value, current_value, unit, direction, kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        kind === "boolean"
          ? [uuid(), id, str("name"), null, num("current_value"), null, "up", "boolean"]
          : [uuid(), id, str("name"), num("target_value"), num("current_value"), str("unit") || null,
              form.get("direction") === "down" ? "down" : "up", "numeric"]
      );
      break;
    }

    case "update_kpi":
      await sql(
        "UPDATE project_kpis SET current_value = ?, updated_at = NOW() WHERE id = ? AND project_id = ?",
        [num("current_value"), str("kpi_id"), id]
      );
      await logActivity({
        clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
        eventType: "kpi.updated", summary: `KPI updated: ${str("kpi_name") || "value"} → ${str("current_value")}`,
      });
      break;

    case "delete_kpi":
      await sql("DELETE FROM project_kpis WHERE id = ? AND project_id = ?", [str("kpi_id"), id]);
      break;

    case "add_link":
      if (!str("label") || !/^https?:\/\//.test(str("url"))) {
        return new Response("Label and http(s) URL required", { status: 400 });
      }
      await sql("INSERT INTO project_links (id, project_id, label, url) VALUES (?, ?, ?, ?)", [
        uuid(), id, str("label"), str("url"),
      ]);
      break;

    case "delete_link":
      await sql("DELETE FROM project_links WHERE id = ? AND project_id = ?", [str("link_id"), id]);
      break;

    case "add_person":
      if (!str("name")) return new Response("Name required", { status: 400 });
      await sql(
        "INSERT INTO project_people (id, project_id, side, name, role, email) VALUES (?, ?, ?, ?, ?, ?)",
        [uuid(), id, form.get("side") === "client" ? "client" : "operator",
          str("name"), str("role") || null, str("email") || null]
      );
      break;

    case "delete_person":
      await sql("DELETE FROM project_people WHERE id = ? AND project_id = ?", [str("person_id"), id]);
      break;

    case "add_decision":
      if (!str("summary")) return new Response("Decision summary required", { status: 400 });
      await sql(
        "INSERT INTO decision_log (id, project_id, decided_on, summary, recorded_by, source) VALUES (?, ?, ?, ?, ?, 'manual')",
        [uuid(), id, str("decided_on") || new Date().toISOString().slice(0, 10), str("summary"), operator.name]
      );
      break;

    case "update_decision":
      if (!str("summary")) return new Response("Decision summary required", { status: 400 });
      await sql(
        "UPDATE decision_log SET summary = ?, decided_on = COALESCE(NULLIF(?, ''), decided_on) WHERE id = ? AND project_id = ?",
        [str("summary"), str("decided_on"), str("decision_id"), id]
      );
      break;

    case "delete_decision":
      await sql("DELETE FROM decision_log WHERE id = ? AND project_id = ?", [str("decision_id"), id]);
      break;

    case "add_working":
      if (!str("title")) return new Response("Title required", { status: 400 });
      await sql("INSERT INTO working_items (id, project_id, title) VALUES (?, ?, ?)", [uuid(), id, str("title")]);
      break;

    case "update_working":
      if (!str("title")) return new Response("Title required", { status: 400 });
      await sql("UPDATE working_items SET title = ? WHERE id = ? AND project_id = ?", [str("title"), str("item_id"), id]);
      break;

    case "finish_working":
      await sql("UPDATE working_items SET status = 'done' WHERE id = ? AND project_id = ?", [str("item_id"), id]);
      break;

    case "queue_working":
      await sql("UPDATE working_items SET status = 'queued' WHERE id = ? AND project_id = ?", [str("item_id"), id]);
      break;

    case "reopen_working":
      await sql("UPDATE working_items SET status = 'active' WHERE id = ? AND project_id = ?", [str("item_id"), id]);
      break;

    case "delete_working":
      await sql("DELETE FROM working_items WHERE id = ? AND project_id = ?", [str("item_id"), id]);
      break;

    case "create_file_request":
      if (!str("title")) return new Response("Title required", { status: 400 });
      await sql("INSERT INTO file_requests (id, project_id, title, note) VALUES (?, ?, ?, ?)", [
        uuid(), id, str("title"), str("note") || null,
      ]);
      await logActivity({
        clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
        eventType: "file_request.created", summary: `File requested from client: "${str("title")}"`,
      });
      await notifyClient(
        project.client_id,
        `We need a file from you: ${str("title")}`,
        `For ${project.title}: ${str("note") || str("title")}\n\nSign in to upload it.`
      );
      break;

    case "add_note":
      if (!str("content")) return new Response("Note content required", { status: 400 });
      await sql(
        "INSERT INTO internal_notes (id, client_id, project_id, author_name, content) VALUES (?, ?, ?, ?, ?)",
        [uuid(), project.client_id, id, operator.name, str("content")]
      );
      break;

    case "update_note":
      if (!str("content")) return new Response("Note content required", { status: 400 });
      await sql("UPDATE internal_notes SET content = ? WHERE id = ? AND project_id = ?", [
        str("content"), str("note_id"), id,
      ]);
      break;

    case "delete_note":
      await sql("DELETE FROM internal_notes WHERE id = ? AND project_id = ?", [str("note_id"), id]);
      break;

    default:
      return new Response("Unknown action", { status: 400 });
  }
  return redirectBack(request, form);
}
