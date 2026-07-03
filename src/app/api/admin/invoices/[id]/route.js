import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, uniqueViolation } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";
import { CURRENCIES } from "@/lib/money";

function parseLineItems(raw) {
  let rows;
  try { rows = JSON.parse(raw || "[]"); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({ description: String(r.description || "").trim(), quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0 }))
    .filter((r) => r.description && r.quantity > 0);
}

// _action: mark_paid | resolve_dispute (back to Unpaid) | mark_overdue | edit | delete
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

  if (action === "delete") {
    await sql("DELETE FROM invoices WHERE id = ?", [id]); // line items cascade
    await logActivity({
      clientId: inv.client_id, projectId: inv.project_id, actorType: "operator", actorName: operator.name,
      eventType: "invoice.deleted", summary: `Invoice ${inv.invoice_number} deleted`,
    });
    return redirectBack(request, form);
  } else if (action === "edit") {
    const number = String(form.get("invoice_number") || "").trim();
    const issued = String(form.get("issued_date") || "");
    const due = String(form.get("due_date") || "");
    const currencyRaw = String(form.get("currency") || "USD");
    const currency = CURRENCIES.includes(currencyRaw) ? currencyRaw : "USD";
    const lineItems = parseLineItems(form.get("line_items"));
    const amount = lineItems.length
      ? lineItems.reduce((sum, r) => sum + r.quantity * r.unit_price, 0)
      : Number(form.get("amount"));
    if (!number || !(amount > 0) || !issued || !due) {
      return new Response("invoice_number, at least one line item (or amount), issued and due dates required", { status: 400 });
    }
    try {
      await sql(
        "UPDATE invoices SET invoice_number = ?, currency = ?, amount = ?, issued_date = ?, due_date = ? WHERE id = ?",
        [number, currency, amount, issued, due, id]
      );
    } catch (e) {
      const msg = uniqueViolation(e);
      if (msg) return new Response(msg, { status: 409 });
      throw e;
    }
    await sql("DELETE FROM invoice_line_items WHERE invoice_id = ?", [id]);
    for (let i = 0; i < lineItems.length; i++) {
      const r = lineItems[i];
      await sql(
        "INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [uuid(), id, r.description, r.quantity, r.unit_price, i]
      );
    }
    return redirectBack(request, form);
  } else if (action === "mark_paid") {
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
      `We've reviewed your dispute on invoice ${inv.invoice_number} (${inv.project_title}). The invoice is now active again. Check the project thread for details.`
    );
  } else if (action === "mark_overdue") {
    if (inv.status !== "Unpaid") return new Response("Only unpaid invoices can be marked overdue", { status: 409 });
    await sql("UPDATE invoices SET status = 'Overdue' WHERE id = ?", [id]);
  } else {
    return new Response("Unknown action", { status: 400 });
  }
  return redirectBack(request, form);
}
