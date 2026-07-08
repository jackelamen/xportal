import { sql } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect } from "@/lib/admin";

// Remove a teammate's operator access. Guards protect against locking the team
// out: you can't remove yourself, and you can't remove the last operator.
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const form = await request.formData();
  const action = form.get("_action");
  if (action !== "delete") return errorRedirect(request, form, "Unknown action");

  if (id === operator.id) return errorRedirect(request, form, "You can't remove your own access");
  const { n } = (await sql("SELECT COUNT(*)::int AS n FROM operator_users"))[0];
  if (n <= 1) return errorRedirect(request, form, "At least one operator must remain");

  await sql("DELETE FROM operator_users WHERE id = ?", [id]);
  await sql("DELETE FROM active_sessions WHERE user_type = 'operator' AND user_id = ?", [id]);
  return redirectBack(request, form);
}
