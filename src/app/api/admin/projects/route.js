import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, uniqueViolation } from "@/lib/admin";

export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const clientId = String(form.get("client_id") || "");
  const title = String(form.get("title") || "").trim();
  if (!title || !(await sql("SELECT id FROM clients WHERE id = ?", [clientId]))[0]) {
    return new Response("client_id and title are required", { status: 400 });
  }
  try {
    await sql(
      `INSERT INTO portal_projects (id, client_id, title, current_phase, target_date, xpm_project_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuid(), clientId, title,
        String(form.get("current_phase") || ""),
        String(form.get("target_date") || "") || null,
        String(form.get("xpm_project_id") || "").trim() || null,
      ]
    );
  } catch (e) {
    const msg = uniqueViolation(e);
    if (msg) return new Response(msg, { status: 409 });
    throw e;
  }
  return redirectBack(request, form);
}
