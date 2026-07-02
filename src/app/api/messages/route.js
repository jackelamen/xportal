import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

export async function POST(request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview. Actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { project_id, invoice_id, message_content } = await request.json().catch(() => ({}));
  if (!message_content?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const project = (await sql(
    "SELECT * FROM portal_projects WHERE id = ? AND client_id = ?",
    [project_id, client.id]
  ))[0];
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invoice_id) {
    const inv = (await sql("SELECT id FROM invoices WHERE id = ? AND project_id = ?", [invoice_id, project_id]))[0];
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  await sql(
    "INSERT INTO communication_threads (id, project_id, invoice_id, sender_type, sender_name, message_content) VALUES (?, ?, ?, 'Client', ?, ?)",
    [uuid(), project_id, invoice_id || null, user.name, message_content.trim()]
  );

  await logActivity({
    clientId: client.id, projectId: project_id, actorType: "client", actorName: user.name,
    eventType: "message.sent", summary: `${user.name} sent a message`,
  });
  await notifyOperators(
    `[${client.company_name}] New message on ${project.title}`,
    `${user.name} wrote:\n\n${message_content.trim()}`
  );
  await notifyXpm("message.created", {
    xpm_project_id: project.xpm_project_id, message: message_content.trim(), sender: user.name,
  });
  return NextResponse.json({ ok: true });
}
