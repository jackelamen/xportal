import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";
import { saveUpload } from "@/lib/storage";

// Branding + contact management for one client. Multipart because of the logo.
// _action: branding | add_user | remove_user | add_note | update_note | delete_note
export async function POST(request, { params }) {
  const { error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  if (!(await sql("SELECT id FROM clients WHERE id = ?", [id]))[0]) {
    return new Response("Not found", { status: 404 });
  }

  const form = await request.formData();
  const action = form.get("_action");

  if (action === "branding") {
    const accent = String(form.get("accent_color") || "").trim();
    const slug = String(form.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) {
      return new Response("Accent color must be a #rrggbb value", { status: 400 });
    }
    let logoPath;
    const logo = form.get("logo");
    if (logo && typeof logo === "object" && logo.size > 0) {
      if (logo.size > 2_000_000) return new Response("Logo must be under 2 MB", { status: 400 });
      logoPath = (await saveUpload(logo, "logos")).storedPath;
    }
    await sql(
      `UPDATE clients SET
         accent_color = COALESCE(NULLIF(?, ''), accent_color),
         slug = COALESCE(NULLIF(?, ''), slug),
         logo_path = COALESCE(?, logo_path)
       WHERE id = ?`,
      [accent, slug, logoPath ?? null, id]
    );
  } else if (action === "add_user") {
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    if (!name || !email) return new Response("Name and email are required", { status: 400 });
    await sql(
      "INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)",
      [uuid(), id, name, email]
    );
  } else if (action === "remove_user") {
    await sql("DELETE FROM client_users WHERE id = ? AND client_id = ?", [
      String(form.get("user_id")), id,
    ]);
  } else if (action === "add_note") {
    const content = String(form.get("content") || "").trim();
    if (!content) return new Response("Note content required", { status: 400 });
    const { getOperatorSession } = await import("@/lib/auth");
    const op = await getOperatorSession();
    await sql(
      "INSERT INTO internal_notes (id, client_id, project_id, author_name, content) VALUES (?, ?, NULL, ?, ?)",
      [uuid(), id, op?.name || "Operator", content]
    );
  } else if (action === "update_note") {
    const content = String(form.get("content") || "").trim();
    if (!content) return new Response("Note content required", { status: 400 });
    await sql(
      "UPDATE internal_notes SET content = ? WHERE id = ? AND client_id = ? AND project_id IS NULL",
      [content, String(form.get("note_id")), id]
    );
  } else if (action === "delete_note") {
    await sql(
      "DELETE FROM internal_notes WHERE id = ? AND client_id = ? AND project_id IS NULL",
      [String(form.get("note_id")), id]
    );
  } else {
    return new Response("Unknown action", { status: 400 });
  }
  return redirectBack(request, form);
}
