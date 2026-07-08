import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";
import { buildVersion } from "@/lib/deliverable-version";

// Create a deliverable with its first version - uploaded document or link.
export async function POST(request) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const projectId = String(form.get("project_id") || "");
  const title = String(form.get("title") || "").trim();
  const project = (await sql("SELECT * FROM portal_projects WHERE id = ?", [projectId]))[0];
  if (!project || !title) return errorRedirect(request, form, "project_id and title are required");

  const version = await buildVersion(form);
  if (version.error) return errorRedirect(request, form, version.error);

  const id = uuid();
  await sql("INSERT INTO deliverables_approvals (id, project_id, title) VALUES (?, ?, ?)", [id, projectId, title]);
  await sql(
    `INSERT INTO deliverable_versions (id, deliverable_id, version_no, kind, asset_path, original_name, note)
     VALUES (?, ?, 1, ?, ?, ?, ?)`,
    [uuid(), id, version.kind, version.assetPath, version.originalName, version.note]
  );

  await logActivity({
    clientId: project.client_id, projectId, actorType: "operator", actorName: operator.name,
    eventType: "deliverable.submitted", summary: `"${title}" submitted for review`,
  });
  await notifyClient(
    project.client_id,
    `New deliverable awaiting your review: ${title}`,
    `"${title}" is ready for your review on ${project.title}. Sign in to approve it or request revisions.`
  );
  return redirectBack(request, form);
}
