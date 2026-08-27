import { NextResponse } from "next/server";
import { findUserByEmail, createSession, setSessionCookie } from "@/lib/auth";

// Operator sign-in with the shared xPM account: credentials are verified by
// Supabase Auth (same project as xPM), then gated by the operator_users
// allowlist - a valid xPM login alone does not grant operator access.
//
// Wrapped in try/catch so a misconfigured XPM_SUPABASE_URL (a typo, missing
// scheme, or an env var that hasn't taken effect yet - Vercel needs a
// redeploy after adding one) throws a clean JSON error instead of crashing
// into an HTML error page, which the login form can't parse and just shows
// as a generic "Sign-in failed" with no way to tell what actually happened.
export async function POST(request) {
  try {
    const { email, password } = await request.json().catch(() => ({}));
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const base = process.env.XPM_SUPABASE_URL;
    const anonKey = process.env.XPM_SUPABASE_ANON_KEY;
    if (!base || !anonKey) {
      console.error("[operator-login] XPM_SUPABASE_URL / XPM_SUPABASE_ANON_KEY not configured");
      return NextResponse.json({ error: "Auth is not configured" }, { status: 500 });
    }

    let res;
    try {
      res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
    } catch (fetchErr) {
      console.error("[operator-login] fetch to XPM_SUPABASE_URL failed:", fetchErr.message, "base=", base);
      return NextResponse.json({ error: "Couldn't reach the auth service. Check XPM_SUPABASE_URL." }, { status: 502 });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[operator-login] Supabase token request rejected:", res.status, body.slice(0, 300));
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const operator = await findUserByEmail("operator", email);
    if (!operator) {
      return NextResponse.json({ error: "This account does not have operator access" }, { status: 403 });
    }

    const sessionRaw = await createSession("operator", operator.id);
    await setSessionCookie("operator", sessionRaw);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[operator-login] unexpected error:", err);
    return NextResponse.json({ error: "Something went wrong signing in. Try again." }, { status: 500 });
  }
}
