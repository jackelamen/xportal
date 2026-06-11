import { sql } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";

// _action: mark_paid | resolve_dispute (back to Unpaid) | mark_overdue
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const inv = (await sql(
    `SELECT i.*, p.client_id, p.id AS project_id, p.title AS project_title
     FROM invoices i JOIN portal_projects p ON p.id = i.project_id WHERE i.id = ?`,
    [id]
  ))[0];
  if (!inv) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const action = form.get("_action");

  if (action === "mark_paid") {
    await sql("UPDATE invoices SET status = 'Paid' WHERE id = ?", [id]);
    await logActivity({
      clientId: inv.client_id, projectId: inv.project_id, actorType: "operator", actorName: operator.name,
      eventType: "invoice.paid", summary: `Invoice ${inv.invoice_number} marked paid`,
    });
  } else if (action === "resolve_dispute") {
    if (inv.status !== "Disputed") return new Response("Invoice is not disputed", { status: 409 });
    await sql("UPDATE invoices SET status = 'Unpaid', dispute_reason = NULL WHERE id = ?", [id]);
    await notifyClient(
      inv.client_id,
      `Dispute resolved on invoice ${inv.invoice_number}`,
      `We've reviewed your dispute on invoice ${inv.invoice_number} (${inv.project_title}). The invoice is now active again — check the project thread for details.`
    );
  } else if (action === "mark_overdue") {
    if (inv.status !== "Unpaid") return new Response("Only unpaid invoices can be marked overdue", { status: 409 });
    await sql("UPDATE invoices SET status = 'Overdue' WHERE id = ?", [id]);
  } else {
    return new Response("Unknown action", { status: 400 });
  }
  return redirectBack(request, form);
}
