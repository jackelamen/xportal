import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { requireOperator } from "@/lib/admin";

// Enter / exit "preview as client". The cookie makes getClientSession return
// a read-only impersonated session for the operator. _action: enter | exit
export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const store = await cookies();

  if (form.get("_action") === "exit") {
    store.delete("xportal_preview");
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  const clientId = String(form.get("client_id") || "");
  if (!(await sql("SELECT id FROM clients WHERE id = ?", [clientId]))[0]) {
    return new Response("Client not found", { status: 404 });
  }
  store.set("xportal_preview", clientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return NextResponse.redirect(new URL("/portal", request.url), 303);
}
