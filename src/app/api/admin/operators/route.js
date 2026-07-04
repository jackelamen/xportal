import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, uniqueViolation } from "@/lib/admin";

// Add a teammate to the operator allowlist. Operators authenticate with the
// shared xPM/Supabase Auth login, so this doesn't set a password: it grants
// access to whoever signs in with that email (they need an xPM account).
export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!name || !email) return new Response("Name and email are required", { status: 400 });

  try {
    await sql("INSERT INTO operator_users (id, name, email) VALUES (?, ?, ?)", [uuid(), name, email]);
  } catch (e) {
    const msg = uniqueViolation(e);
    if (msg) return new Response(msg, { status: 409 });
    throw e;
  }
  return redirectBack(request, form);
}
