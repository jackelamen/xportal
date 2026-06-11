import { getDb, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";

// Operator reply into a project (or invoice-scoped) thread.
export async function POST(request) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const projectId = String(form.get("project_id") || "");
  const invoiceId = String(form.get("invoice_id") || "") || null;
  const content = String(form.get("message_content") || "").trim();

  const db = getDb();
  const project = db.prepare("SELECT * FROM portal_projects WHERE id = ?").get(projectId);
  if (!project || !content) return new Response("project_id and message are required", { status: 400 });

  db.prepare(
    `INSERT INTO communication_threads (id, project_id, invoice_id, sender_type, sender_name, message_content, operator_read)
     VALUES (?, ?, ?, 'Internal_Operator', ?, ?, 1)`
  ).run(uuid(), projectId, invoiceId, operator.name, content);

  logActivity({
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
