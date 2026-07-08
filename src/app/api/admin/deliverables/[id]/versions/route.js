import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";
import { buildVersion } from "@/lib/deliverable-version";

// Upload a new version (typically after revisions); re-opens the approval.
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const form = await request.formData();
  const row = (await sql(
    `SELECT d.*, p.client_id, p.title AS project_title FROM deliverables_approvals d
     JOIN portal_projects p ON p.id = d.project_id WHERE d.id = ?`,
    [id]
  ))[0];
  if (!row) return errorRedirect(request, form, "Not found");

  const version = await buildVersion(form);
  if (version.error) return errorRedirect(request, form, version.error);

  const mxRow = (await sql("SELECT MAX(version_no) AS mx FROM deliverable_versions WHERE deliverable_id = ?", [id]))[0];
  const mx = mxRow?.mx ?? 0;
  await sql(
    `INSERT INTO deliverable_versions (id, deliverable_id, version_no, kind, asset_path, original_name, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), id, mx + 1, version.kind, version.assetPath, version.originalName, version.note]
  );
  await sql(
    "UPDATE deliverables_approvals SET status = 'Pending', feedback_notes = NULL, actioned_by = NULL, actioned_at = NULL WHERE id = ?",
    [id]
  );

  await logActivity({
    clientId: row.client_id, projectId: row.project_id, actorType: "operator", actorName: operator.name,
    eventType: "deliverable.submitted", summary: `"${row.title}" v${mx + 1} submitted for review`,
  });
  await notifyClient(
    row.client_id,
    `Updated deliverable awaiting your review: ${row.title}`,
    `A new version of "${row.title}" is ready on ${row.project_title}. Sign in to review it.`
  );
  return redirectBack(request, form);
}
