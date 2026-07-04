import { sql } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";

// Remove a teammate's operator access. Guards protect against locking the team
// out: you can't remove yourself, and you can't remove the last operator.
export async function POST(request, { params }) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const form = await request.formData();
  const action = form.get("_action");
  if (action !== "delete") return new Response("Unknown action", { status: 400 });

  if (id === operator.id) return new Response("You can't remove your own access", { status: 409 });
  const { n } = (await sql("SELECT COUNT(*)::int AS n FROM operator_users"))[0];
  if (n <= 1) return new Response("At least one operator must remain", { status: 409 });

  await sql("DELETE FROM operator_users WHERE id = ?", [id]);
  await sql("DELETE FROM active_sessions WHERE user_type = 'operator' AND user_id = ?", [id]);
  return redirectBack(request, form);
}
