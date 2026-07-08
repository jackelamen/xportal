import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import { syncCurrentPhase } from "@/lib/project-import";

// _action: status | add_milestone | set_milestone_status | delete_milestone | toggle_visibility
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const form = await request.formData();
  const project = (await sql("SELECT * FROM portal_projects WHERE id = ?", [id]))[0];
  if (!project) return errorRedirect(request, form, "Not found");

  const action = form.get("_action");

  if (action === "archive") {
    await sql("UPDATE portal_projects SET archived_at = NOW() WHERE id = ?", [id]);
    await logActivity({
      clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
      eventType: "project.archived", summary: `${operator.name} archived "${project.title}"`,
    });
    return redirectBack(request, form);
  } else if (action === "unarchive") {
    await sql("UPDATE portal_projects SET archived_at = NULL WHERE id = ?", [id]);
    await logActivity({
      clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
      eventType: "project.unarchived", summary: `${operator.name} restored "${project.title}"`,
    });
    return redirectBack(request, form);
  } else if (action === "delete") {
    // Guarded: the operator types the exact project title. The delete cascades
    // to every milestone, deliverable, invoice, message, and document.
    const confirm = String(form.get("confirm_title") || "").trim().toLowerCase();
    if (confirm !== String(project.title).trim().toLowerCase()) {
      return errorRedirect(request, form, "Type the project's exact title to confirm deletion.");
    }
    await sql("DELETE FROM portal_projects WHERE id = ?", [id]);
    return redirectBack(request, form);
  } else if (action === "toggle_visibility") {
    const next = project.hidden_from_client ? 0 : 1;
    await sql("UPDATE portal_projects SET hidden_from_client = ? WHERE id = ?", [next, id]);
    await logActivity({
      clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
      eventType: "project.visibility",
      summary: `${operator.name} ${next ? "hid" : "published"} "${project.title}" ${next ? "from" : "to"} the client portal`,
    });
  } else if (action === "status") {
    // Phase and target date are no longer set here - they're derived from
    // Plan (see syncCurrentPhase below). Progress is the one thing that
    // genuinely needs a human's judgment call, so it stays manual.
    await sql(
      "UPDATE portal_projects SET progress_percentage = ?, updated_at = NOW() WHERE id = ?",
      [Math.min(100, Math.max(0, Number(form.get("progress_percentage")) || 0)), id]
    );
  } else if (action === "add_milestone") {
    const title = String(form.get("title") || "").trim();
    if (!title) return errorRedirect(request, form, "Milestone title required");
    const mxRow = (await sql(
      "SELECT COALESCE(MAX(sort_order), -1) AS mx FROM project_milestones WHERE project_id = ?", [id]
    ))[0];
    await sql(
      `INSERT INTO project_milestones (id, project_id, title, kind, starts_on, ends_on, status, detail, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(), id, title,
        form.get("kind") === "milestone" ? "milestone" : "phase",
        String(form.get("starts_on") || "") || null,
        String(form.get("ends_on") || "") || null,
        String(form.get("status") || "upcoming"),
        String(form.get("detail") || "").trim() || null,
        (mxRow?.mx ?? -1) + 1,
      ]
    );
  } else if (action === "edit_milestone") {
    const title = String(form.get("title") || "").trim();
    if (!title) return errorRedirect(request, form, "Milestone title required");
    await sql(
      `UPDATE project_milestones SET title = ?, starts_on = ?, ends_on = ?, detail = ?
       WHERE id = ? AND project_id = ?`,
      [
        title,
        String(form.get("starts_on") || "") || null,
        String(form.get("ends_on") || "") || null,
        String(form.get("detail") || "").trim() || null,
        String(form.get("milestone_id")), id,
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
    return errorRedirect(request, form, "Unknown action");
  }

  // Plan phase statuses/dates are the single source of truth for
  // current_phase/target_date - recompute after anything that could touch
  // them (a no-op if this project has no phases yet).
  await syncCurrentPhase(id);

  await logActivity({
    clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
    eventType: "project.updated", summary: `${operator.name} updated ${project.title}`,
  });
  return redirectBack(request, form);
}
