import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";
import { logActivity } from "@/lib/activity";

// _action: status | add_milestone | set_milestone_status | delete_milestone | toggle_visibility
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const project = (await sql("SELECT * FROM portal_projects WHERE id = ?", [id]))[0];
  if (!project) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const action = form.get("_action");

  if (action === "toggle_visibility") {
    const next = project.hidden_from_client ? 0 : 1;
    await sql("UPDATE portal_projects SET hidden_from_client = ? WHERE id = ?", [next, id]);
    await logActivity({
      clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
      eventType: "project.visibility",
      summary: `${operator.name} ${next ? "hid" : "published"} "${project.title}" ${next ? "from" : "to"} the client portal`,
    });
  } else if (action === "status") {
    await sql(
      "UPDATE portal_projects SET current_phase = ?, progress_percentage = ?, target_date = ?, updated_at = NOW() WHERE id = ?",
      [
        String(form.get("current_phase") || project.current_phase),
        Math.min(100, Math.max(0, Number(form.get("progress_percentage")) || 0)),
        String(form.get("target_date") || "") || null,
        id,
      ]
    );
  } else if (action === "add_milestone") {
    const title = String(form.get("title") || "").trim();
    if (!title) return new Response("Milestone title required", { status: 400 });
    const mxRow = (await sql(
      "SELECT COALESCE(MAX(sort_order), -1) AS mx FROM project_milestones WHERE project_id = ?", [id]
    ))[0];
    await sql(
      `INSERT INTO project_milestones (id, project_id, title, kind, starts_on, ends_on, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(), id, title,
        form.get("kind") === "milestone" ? "milestone" : "phase",
        String(form.get("starts_on") || "") || null,
        String(form.get("ends_on") || "") || null,
        String(form.get("status") || "upcoming"),
        (mxRow?.mx ?? -1) + 1,
      ]
    );
  } else if (action === "set_milestone_status") {
    await sql("UPDATE project_milestones SET status = ? WHERE id = ? AND project_id = ?", [
      String(form.get("status")), String(form.get("milestone_id")), id,
    ]);
  } else if (action === "delete_milestone") {
    await sql("DELETE FROM project_milestones WHERE id = ? AND project_id = ?", [
      String(form.get("milestone_id")), id,
    ]);
  } else {
    return new Response("Unknown action", { status: 400 });
  }

  await logActivity({
    clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
    eventType: "project.updated", summary: `${operator.name} updated ${project.title}`,
  });
  return redirectBack(request, form);
}
