import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getClientSession } from "@/lib/auth";

// Clients explicitly mark operator messages read or unread.
export async function POST(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview — actions are disabled" }, { status: 403 });

  const { id } = await params;
  const { read } = await request.json().catch(() => ({}));

  const db = getDb();
  const owned = db
    .prepare(
      `SELECT t.id FROM communication_threads t JOIN portal_projects p ON p.id = t.project_id
       WHERE t.id = ? AND p.client_id = ? AND t.sender_type = 'Internal_Operator'`
    )
    .get(id, session.client.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE communication_threads SET is_read = ? WHERE id = ?").run(read ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}
