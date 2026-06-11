import { sql, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";

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

  const clientId = uuid();
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  await sql(
    "INSERT INTO clients (id, company_name, primary_email, slug) VALUES (?, ?, ?, ?)",
    [clientId, company, email, slug || null]
  );
  await sql(
    "INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)",
    [uuid(), clientId, contactName, email]
  );
  return redirectBack(request, form);
}
