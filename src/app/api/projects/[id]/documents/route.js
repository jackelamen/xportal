import { NextResponse } from "next/server";
import { getDb, uuid } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import { logActivity, notifyOperators } from "@/lib/activity";
import { notifyXpm } from "@/lib/xpm-bridge";

const MAX_FILE = 25_000_000;

// Client-side document upload. Clients can only add to the reference library;
// contracts/agreements/reports stay operator-managed. Optionally fulfills an
// open file request.
export async function POST(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview — actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { id } = await params;
  const db = getDb();
  const project = db
    .prepare("SELECT * FROM portal_projects WHERE id = ? AND client_id = ?")
    .get(id, client.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const file = form.get("file");
  if (!title) return NextResponse.json({ error: "A document title is required" }, { status: 400 });
  if (!file || typeof file !== "object" || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE) {
    return NextResponse.json({ error: "File must be under 25 MB" }, { status: 400 });
  }

  const requestId = String(form.get("file_request_id") || "") || null;
  let fileRequest = null;
  if (requestId) {
    fileRequest = db
      .prepare("SELECT * FROM file_requests WHERE id = ? AND project_id = ? AND status = 'open'")
      .get(requestId, id);
    if (!fileRequest) {
      return NextResponse.json({ error: "That file request is no longer open" }, { status: 409 });
    }
  }

  const saved = await saveUpload(file, "documents");
  const docId = uuid();
  db.prepare(
    `INSERT INTO project_documents (id, project_id, category, title, kind, asset_path, original_name, uploaded_by_type, uploaded_by_name)
     VALUES (?, ?, 'reference', ?, 'file', ?, ?, 'client', ?)`
  ).run(docId, id, title, saved.storedPath, saved.originalName, user.name);

  if (fileRequest) {
    db.prepare(
      "UPDATE file_requests SET status = 'fulfilled', document_id = ?, fulfilled_at = datetime('now') WHERE id = ?"
    ).run(docId, fileRequest.id);
  }

  logActivity({
    clientId: client.id, projectId: id, actorType: "client", actorName: user.name,
    eventType: "document.uploaded",
    summary: fileRequest
      ? `${user.name} fulfilled file request "${fileRequest.title}" with "${title}"`
      : `${user.name} uploaded reference document "${title}"`,
  });
  await notifyOperators(
    `[${client.company_name}] ${fileRequest ? "File request fulfilled" : "Reference document uploaded"}`,
    `${user.name} uploaded "${title}" (${saved.originalName}) on ${project.title}.`
  );
  await notifyXpm(fileRequest ? "file_request.fulfilled" : "document.uploaded", {
    xpm_project_id: project.xpm_project_id,
    document_title: title,
    file_request_id: fileRequest?.id || null,
    uploaded_by: user.name,
  });
  return NextResponse.json({ ok: true, document_id: docId });
}
