import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";

// Operator reply into a project (or invoice-scoped) thread, or clearing that
// project's whole conversation.
export async function POST(request) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const action = form.get("_action");
  const projectId = String(form.get("project_id") || "");

  const project = (await sql("SELECT * FROM portal_projects WHERE id = ?", [projectId]))[0];
  if (!project) return errorRedirect(request, form, "project_id is required");

  if (action === "clear") {
    // Deletes both sides of the conversation - the client's portal shows the
    // same rows, so this empties their Messages tab too. Not reversible.
    // Not logged to activity_log: that feed is client-visible, and clearing
    // is an internal housekeeping action, not something to surface to them.
    await sql("DELETE FROM communication_threads WHERE project_id = ?", [projectId]);
    return redirectBack(request, form);
  }

  const invoiceId = String(form.get("invoice_id") || "") || null;
  const content = String(form.get("message_content") || "").trim();
  if (!content) return errorRedirect(request, form, "message is required");

  await sql(
    `INSERT INTO communication_threads (id, project_id, invoice_id, sender_type, sender_name, message_content, operator_read)
     VALUES (?, ?, ?, 'Internal_Operator', ?, ?, 1)`,
    [uuid(), projectId, invoiceId, operator.name, content]
  );

  await logActivity({
    clientId: project.client_id, projectId, actorType: "operator", actorName: operator.name,
    eventType: "message.sent", summary: `${operator.name} sent a message`,
  });
  await notifyClient(
    project.client_id,
    `New message on ${project.title}`,
    `${operator.name} wrote:\n\n${content}\n\nSign in to reply.`
  );
  return redirectBack(request, form);
}
