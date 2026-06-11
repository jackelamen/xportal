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
