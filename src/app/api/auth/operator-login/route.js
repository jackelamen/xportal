import { NextResponse } from "next/server";
import { findUserByEmail, createSession, setSessionCookie } from "@/lib/auth";

// Operator sign-in with the shared xPM account: credentials are verified by
// Supabase Auth (same project as xPM), then gated by the operator_users
// allowlist — a valid xPM login alone does not grant operator access.
export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const base = process.env.XPM_SUPABASE_URL;
  const anonKey = process.env.XPM_SUPABASE_ANON_KEY;
  if (!base || !anonKey) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 500 });
  }

  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const operator = await findUserByEmail("operator", email);
  if (!operator) {
    return NextResponse.json({ error: "This account does not have operator access" }, { status: 403 });
  }

  const sessionRaw = await createSession("operator", operator.id);
  await setSessionCookie("operator", sessionRaw);
  return NextResponse.json({ ok: true });
}
