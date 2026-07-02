import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

// Disputing freezes the invoice (no overdue escalation), records the reason,
// and opens an invoice-scoped message thread for the back-and-forth.
export async function POST(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview. Actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { id } = await params;
  const { reason } = await request.json().catch(() => ({}));
  if (!reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to dispute an invoice" }, { status: 400 });
  }

  const inv = (await sql(
    `SELECT i.*, p.client_id, p.title AS project_title, p.xpm_project_id
     FROM invoices i JOIN portal_projects p ON p.id = i.project_id
     WHERE i.id = ? AND p.client_id = ?`,
    [id, client.id]
  ))[0];
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inv.status === "Paid") {
    return NextResponse.json({ error: "Paid invoices cannot be disputed here. Message the team instead" }, { status: 409 });
  }
  if (inv.status === "Disputed") {
    return NextResponse.json({ error: "This invoice is already under dispute" }, { status: 409 });
  }

  await sql("UPDATE invoices SET status = 'Disputed', dispute_reason = ? WHERE id = ?", [reason.trim(), id]);
  await sql(
    "INSERT INTO communication_threads (id, project_id, invoice_id, sender_type, sender_name, message_content) VALUES (?, ?, ?, 'Client', ?, ?)",
    [uuid(), inv.project_id, id, user.name, `Invoice ${inv.invoice_number} disputed: ${reason.trim()}`]
  );

  await logActivity({
    clientId: client.id, projectId: inv.project_id, actorType: "client", actorName: user.name,
    eventType: "invoice.disputed", summary: `${user.name} disputed invoice ${inv.invoice_number}`,
  });
  await notifyOperators(
    `[${client.company_name}] Invoice ${inv.invoice_number} disputed`,
    `${user.name} disputed invoice ${inv.invoice_number} ($${Number(inv.amount).toFixed(2)}, ${inv.project_title}):\n\n${reason.trim()}`
  );
  await notifyXpm("invoice.disputed", {
    invoice_number: inv.invoice_number, xpm_project_id: inv.xpm_project_id,
    reason: reason.trim(), disputed_by: user.name,
  });
  return NextResponse.json({ ok: true });
}
