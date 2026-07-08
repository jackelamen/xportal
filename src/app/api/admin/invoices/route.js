import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect, uniqueViolation } from "@/lib/admin";
import { logActivity, notifyClient } from "@/lib/activity";
import { formatMoney, CURRENCIES } from "@/lib/money";

// Parse the line_items hidden field (JSON from the admin form). Each valid row
// needs a description and a non-negative amount; the invoice total is their sum.
function parseLineItems(raw) {
  let rows;
  try {
    rows = JSON.parse(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      description: String(r.description || "").trim(),
      quantity: Number(r.quantity) || 0,
      unit_price: Number(r.unit_price) || 0,
    }))
    .filter((r) => r.description && r.quantity > 0);
}

export async function POST(request) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const projectId = String(form.get("project_id") || "");
  const number = String(form.get("invoice_number") || "").trim();
  const issued = String(form.get("issued_date") || "");
  const due = String(form.get("due_date") || "");
  const currencyRaw = String(form.get("currency") || "USD");
  const currency = CURRENCIES.includes(currencyRaw) ? currencyRaw : "USD";

  const lineItems = parseLineItems(form.get("line_items"));
  // Total comes from line items when present; otherwise the single amount field
  // (kept for backward compatibility with any caller not sending line items).
  const amount = lineItems.length
    ? lineItems.reduce((sum, r) => sum + r.quantity * r.unit_price, 0)
    : Number(form.get("amount"));

  const project = (await sql("SELECT * FROM portal_projects WHERE id = ?", [projectId]))[0];
  if (!project || !number || !(amount > 0) || !issued || !due) {
    return errorRedirect(request, form, "Invoice number, at least one line item (or amount), and issued/due dates are required.");
  }

  const invoiceId = uuid();
  try {
    await sql(
      "INSERT INTO invoices (id, project_id, invoice_number, amount, currency, issued_date, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [invoiceId, projectId, number, amount, currency, issued, due]
    );
  } catch (e) {
    const msg = uniqueViolation(e);
    if (msg) return errorRedirect(request, form, msg);
    throw e;
  }

  for (let i = 0; i < lineItems.length; i++) {
    const r = lineItems[i];
    await sql(
      "INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      [uuid(), invoiceId, r.description, r.quantity, r.unit_price, i]
    );
  }

  const amountLabel = formatMoney(amount, currency, "en");
  await logActivity({
    clientId: project.client_id, projectId, actorType: "operator", actorName: operator.name,
    eventType: "invoice.issued", summary: `Invoice ${number} issued (${amountLabel})`,
  });
  await notifyClient(
    project.client_id,
    `Invoice ${number} issued`,
    `Invoice ${number} for ${amountLabel} (${project.title}) is due ${due}. Sign in to view or download it.`
  );
  return redirectBack(request, form);
}
