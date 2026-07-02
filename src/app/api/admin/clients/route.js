import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack, uniqueViolation } from "@/lib/admin";

export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const company = String(form.get("company_name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const contactName = String(form.get("contact_name") || "").trim();
  if (!company || !email || !contactName) {
    return new Response("company_name, contact_name and email are required", { status: 400 });
  }

  // Email is globally unique across clients (primary_email) and client_users
  // (email) - check up front so a duplicate returns a clear message instead of
  // an unhandled 500.
  const emailTaken =
    (await sql("SELECT 1 FROM clients WHERE lower(primary_email) = ? LIMIT 1", [email]))[0] ||
    (await sql("SELECT 1 FROM client_users WHERE lower(email) = ? LIMIT 1", [email]))[0];
  if (emailTaken) {
    return new Response(`A client or contact with the email ${email} already exists.`, { status: 409 });
  }

  // Slug is unique - derive a base and add a numeric suffix on collision so
  // re-using a company name (e.g. two "Test" clients) doesn't error.
  const base = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  let slug = base || null;
  for (let n = 2; slug && (await sql("SELECT 1 FROM clients WHERE slug = ? LIMIT 1", [slug]))[0]; n++) {
    slug = `${base.slice(0, 36)}-${n}`;
  }

  const clientId = uuid();
  try {
    await sql(
      "INSERT INTO clients (id, company_name, primary_email, slug) VALUES (?, ?, ?, ?)",
      [clientId, company, email, slug]
    );
    await sql(
      "INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)",
      [uuid(), clientId, contactName, email]
    );
  } catch (e) {
    // Roll back a half-created client so a failed second insert can't orphan a
    // row (the two inserts aren't a single transaction).
    await sql("DELETE FROM clients WHERE id = ?", [clientId]).catch(() => {});
    const msg = uniqueViolation(e);
    if (msg) return new Response(msg, { status: 409 });
    throw e;
  }
  return redirectBack(request, form);
}
