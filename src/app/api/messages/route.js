import { NextResponse } from "next/server";
import { getDb, uuid } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

export async function POST(request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview — actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { project_id, invoice_id, message_content } = await request.json().catch(() => ({}));
  if (!message_content?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const db = getDb();
  const project = db
    .prepare("SELECT * FROM portal_projects WHERE id = ? AND client_id = ?")
    .get(project_id, client.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Invoice-scoped messages (dispute threads) must reference an invoice on this project.
  if (invoice_id) {
    const inv = db
      .prepare("SELECT id FROM invoices WHERE id = ? AND project_id = ?")
      .get(invoice_id, project_id);
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  db.prepare(
    `INSERT INTO communication_threads (id, project_id, invoice_id, sender_type, sender_name, message_content)
     VALUES (?, ?, ?, 'Client', ?, ?)`
  ).run(uuid(), project_id, invoice_id || null, user.name, message_content.trim());

  logActivity({
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
