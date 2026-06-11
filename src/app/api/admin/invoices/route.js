import { getDb, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";

export async function POST(request) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const projectId = String(form.get("project_id") || "");
  const number = String(form.get("invoice_number") || "").trim();
  const amount = Number(form.get("amount"));
  const issued = String(form.get("issued_date") || "");
  const due = String(form.get("due_date") || "");

  const db = getDb();
  const project = db.prepare("SELECT * FROM portal_projects WHERE id = ?").get(projectId);
  if (!project || !number || !(amount > 0) || !issued || !due) {
    return new Response("project, invoice_number, positive amount, issued and due dates required", { status: 400 });
  }

  db.prepare(
    `INSERT INTO invoices (id, project_id, invoice_number, amount, issued_date, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), projectId, number, amount, issued, due);

  logActivity({
    clientId: project.client_id, projectId, actorType: "operator", actorName: operator.name,
    eventType: "invoice.issued", summary: `Invoice ${number} issued ($${amount.toFixed(2)})`,
  });
  await notifyClient(
    project.client_id,
    `Invoice ${number} issued`,
    `Invoice ${number} for $${amount.toFixed(2)} (${project.title}) is due ${due}. Sign in to view or download it.`
  );
  return redirectBack(request, form);
}
