import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
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
  if (!getDb().prepare("SELECT id FROM clients WHERE id = ?").get(clientId)) {
    return new Response("Client not found", { status: 404 });
  }
  store.set("xportal_preview", clientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60, // an hour of previewing is plenty
  });
  return NextResponse.redirect(new URL("/portal", request.url), 303);
}
