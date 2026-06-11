import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";
import { saveUpload } from "@/lib/storage";
import { logActivity, notifyClient } from "@/lib/activity";

const CATEGORIES = ["contract", "agreement", "reference", "brand", "report"];
const MAX_FILE = 25_000_000;

// Operator document management: upload (file or link) into any category, or delete.
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const project = (await sql("SELECT * FROM portal_projects WHERE id = ?", [id]))[0];
  if (!project) return new Response("Not found", { status: 404 });

  const form = await request.formData();

  if (form.get("_action") === "delete") {
    await sql("DELETE FROM project_documents WHERE id = ? AND project_id = ?", [
      String(form.get("document_id")), id,
    ]);
    return redirectBack(request, form);
  }

  const title = String(form.get("title") || "").trim();
  const category = CATEGORIES.includes(form.get("category")) ? form.get("category") : "reference";
  if (!title) return new Response("Title required", { status: 400 });

  let kind, assetPath, originalName = null;
  const file = form.get("file");
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > MAX_FILE) return new Response("File must be under 25 MB", { status: 400 });
    const saved = await saveUpload(file, "documents");
    kind = "file"; assetPath = saved.storedPath; originalName = saved.originalName;
  } else {
    const link = String(form.get("link") || "").trim();
    if (!/^https?:\/\//.test(link)) return new Response("Provide a file or http(s) link", { status: 400 });
    kind = "link"; assetPath = link;
  }

  await sql(
    `INSERT INTO project_documents (id, project_id, category, title, kind, asset_path, original_name, uploaded_by_type, uploaded_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'operator', ?)`,
    [uuid(), id, category, title, kind, assetPath, originalName, operator.name]
  );

  await logActivity({
    clientId: project.client_id, projectId: id, actorType: "operator", actorName: operator.name,
    eventType: "document.uploaded", summary: `${category} document added: "${title}"`,
  });
  if (category !== "reference") {
    await notifyClient(
      project.client_id,
      `New ${category} document on ${project.title}`,
      `"${title}" has been added to your project documents. Sign in to view it.`
    );
  }
  return redirectBack(request, form);
}
