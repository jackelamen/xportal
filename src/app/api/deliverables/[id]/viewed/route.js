import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getClientSession } from "@/lib/auth";

// Marks the latest version as viewed the first time the client opens it.
export async function POST(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview — actions are disabled" }, { status: 403 });

  const { id } = await params;
  const { version_id } = await request.json().catch(() => ({}));
  getDb()
    .prepare(
      `UPDATE deliverable_versions SET viewed_at = datetime('now')
       WHERE id = ? AND viewed_at IS NULL AND deliverable_id IN (
         SELECT d.id FROM deliverables_approvals d
         JOIN portal_projects p ON p.id = d.project_id
         WHERE d.id = ? AND p.client_id = ?
       )`
    )
    .run(version_id, id, session.client.id);
  return NextResponse.json({ ok: true });
}
