import { getDb, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";

export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const clientId = String(form.get("client_id") || "");
  const title = String(form.get("title") || "").trim();
  if (!title || !getDb().prepare("SELECT id FROM clients WHERE id = ?").get(clientId)) {
    return new Response("client_id and title are required", { status: 400 });
  }
  getDb()
    .prepare(
      `INSERT INTO portal_projects (id, client_id, title, current_phase, target_date, xpm_project_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      uuid(), clientId, title,
      String(form.get("current_phase") || "Discovery"),
      String(form.get("target_date") || "") || null,
      String(form.get("xpm_project_id") || "").trim() || null
    );
  return redirectBack(request, form);
}
