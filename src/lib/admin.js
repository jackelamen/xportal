import { NextResponse } from "next/server";
import { getOperatorSession } from "./auth";

// Shared guards/helpers for operator-only form-post route handlers.

export async function requireOperator() {
  const op = await getOperatorSession();
  if (!op) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { operator: op };
}

// Admin forms include a hidden _redirect field; fall back to /admin.
export function redirectBack(request, form) {
  const dest = form?.get("_redirect") || "/admin";
  return NextResponse.redirect(new URL(String(dest), request.url), 303);
}

// Friendly messages for the DB's UNIQUE constraints, so a duplicate value
// returns a clear 409 instead of an unhandled 500. Keyed by constraint name
// (Postgres exposes it as err.constraint on a 23505 unique_violation).
const UNIQUE_MESSAGES = {
  client_users_email_key: "A contact with that email already exists.",
  clients_primary_email_key: "A client with that email already exists.",
  clients_slug_key: "That login slug is already taken. Pick another.",
  clients_xpm_space_id_key: "That xPM space is already linked to a client.",
  invoices_invoice_number_key: "That invoice number is already in use.",
  portal_projects_xpm_project_id_key: "That xPM project is already linked to a portal project.",
  operator_users_email_key: "An operator with that email already exists.",
};

// Returns a friendly message if `e` is a Postgres unique-constraint violation,
// otherwise null (so the caller can rethrow real errors).
export function uniqueViolation(e) {
  if (e?.code !== "23505") return null;
  return UNIQUE_MESSAGES[e?.constraint] || "That value is already in use.";
}
