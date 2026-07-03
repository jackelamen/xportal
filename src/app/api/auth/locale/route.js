import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { LOCALES } from "@/lib/i18n";

// Persists the signed-in client's language preference so it's remembered
// across sessions, not just guessed per visit. Preview sessions have no
// underlying client_user row to update (or one they should mutate).
export async function POST(request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview. Actions are disabled" }, { status: 403 });

  const { locale } = await request.json().catch(() => ({}));
  if (!LOCALES.includes(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  await sql("UPDATE client_users SET locale = ? WHERE id = ?", [locale, session.user.id]);
  return NextResponse.json({ ok: true });
}
