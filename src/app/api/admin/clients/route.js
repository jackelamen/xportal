import { getDb, uuid } from "@/lib/db";
import { requireOperator, redirectBack } from "@/lib/admin";

// Create a client company plus its first contact.
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

  const db = getDb();
  const clientId = uuid();
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  db.prepare(
    "INSERT INTO clients (id, company_name, primary_email, slug) VALUES (?, ?, ?, ?)"
  ).run(clientId, company, email, slug || null);
  db.prepare("INSERT INTO client_users (id, client_id, name, email) VALUES (?, ?, ?, ?)").run(
    uuid(), clientId, contactName, email
  );
  return redirectBack(request, form);
}
