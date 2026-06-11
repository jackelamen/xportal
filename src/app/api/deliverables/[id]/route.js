import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

// Approve or request revisions. Ownership is enforced by joining through to
// the session's client_id — clients can never action another entity's rows.
export async function POST(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview — actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { id } = await params;
  const { action, feedback_notes } = await request.json().catch(() => ({}));

  const row = (await sql(
    `SELECT d.*, p.xpm_project_id, p.id AS project_id, p.title AS project_title
     FROM deliverables_approvals d
     JOIN portal_projects p ON p.id = d.project_id
     WHERE d.id = ? AND p.client_id = ?`,
    [id, client.id]
  ))[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "Pending") {
    return NextResponse.json({ error: "Deliverable already actioned" }, { status: 409 });
  }

  if (action === "approve") {
    await sql(
      "UPDATE deliverables_approvals SET status = 'Approved', actioned_by = ?, actioned_at = NOW() WHERE id = ?",
      [user.name, id]
    );
    await sql(
      "INSERT INTO decision_log (id, project_id, decided_on, summary, recorded_by, source) VALUES (?, ?, CURRENT_DATE, ?, ?, 'approval')",
      [uuid(), row.project_id, `Approved deliverable "${row.title}"`, user.name]
    );
    await logActivity({
      clientId: client.id, projectId: row.project_id, actorType: "client", actorName: user.name,
      eventType: "deliverable.approved", summary: `${user.name} approved "${row.title}"`,
    });
    await notifyOperators(
      `[${client.company_name}] Deliverable approved`,
      `${user.name} approved "${row.title}" on ${row.project_title}.`
    );
    await notifyXpm("deliverable.approved", {
      deliverable_id: id, xpm_project_id: row.xpm_project_id, approved_by: user.name,
    });
  } else if (action === "request_revisions") {
    if (!feedback_notes?.trim()) {
      return NextResponse.json({ error: "Feedback notes are required for revisions" }, { status: 400 });
    }
    await sql(
      "UPDATE deliverables_approvals SET status = 'Revisions Requested', feedback_notes = ?, actioned_by = ?, actioned_at = NOW() WHERE id = ?",
      [feedback_notes.trim(), user.name, id]
    );
    await logActivity({
      clientId: client.id, projectId: row.project_id, actorType: "client", actorName: user.name,
      eventType: "deliverable.revisions", summary: `${user.name} requested revisions on "${row.title}"`,
    });
    await notifyOperators(
      `[${client.company_name}] Revisions requested`,
      `${user.name} requested revisions on "${row.title}" (${row.project_title}):\n\n${feedback_notes.trim()}`
    );
    await notifyXpm("deliverable.revisions_requested", {
      deliverable_id: id, xpm_project_id: row.xpm_project_id,
      feedback_notes: feedback_notes.trim(), requested_by: user.name,
    });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
