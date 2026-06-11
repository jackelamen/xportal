import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getOperatorSession } from "@/lib/auth";
import { verifyBridgeSecret } from "@/lib/xpm-bridge";
import { notifyClient } from "@/lib/activity";

// Weekly digest per client: progress, what shipped, what's waiting on them,
// upcoming meetings and milestones. Trigger manually from the admin, or in
// Phase 2 via Vercel Cron with the bridge secret header.
export async function POST(request) {
  const operator = await getOperatorSession();
  if (!operator && !verifyBridgeSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await sql("SELECT * FROM clients");
  let sent = 0;

  for (const client of clients) {
    const projects = await sql("SELECT * FROM portal_projects WHERE client_id = ?", [client.id]);
    if (projects.length === 0) continue;

    const sections = [];
    for (const p of projects) {
      const lines = [`${p.title} — ${p.current_phase}, ${p.progress_percentage}% complete`];

      const delivered = await sql(
        "SELECT title FROM deliverables_approvals WHERE project_id = ? AND submitted_at > (NOW() - INTERVAL '7 days')",
        [p.id]
      );
      if (delivered.length) lines.push(`  Delivered this week: ${delivered.map((d) => d.title).join(", ")}`);

      const pendingDels = await sql(
        "SELECT title FROM deliverables_approvals WHERE project_id = ? AND status = 'Pending'",
        [p.id]
      );
      const waiting = pendingDels.map((d) => `review "${d.title}"`);
      const openRequests = await sql(
        "SELECT title FROM file_requests WHERE project_id = ? AND status = 'open'",
        [p.id]
      );
      waiting.push(...openRequests.map((f) => `upload "${f.title}"`));
      if (waiting.length) lines.push(`  Waiting on you: ${waiting.join("; ")}`);

      const milestones = await sql(
        `SELECT title, starts_on FROM project_milestones
         WHERE project_id = ? AND kind = 'milestone'
         AND starts_on::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 14)`,
        [p.id]
      );
      if (milestones.length) {
        lines.push(`  Coming up: ${milestones.map((m) => `${m.title} (${m.starts_on})`).join(", ")}`);
      }
      sections.push(lines.join("\n"));
    }

    const meetings = await sql(
      `SELECT topic, starts_at FROM bookings
       WHERE client_id = ? AND status = 'confirmed' AND starts_at > NOW()
       ORDER BY starts_at LIMIT 3`,
      [client.id]
    );
    if (meetings.length) {
      sections.push(
        `Upcoming meetings:\n${meetings.map((m) => `  ${String(m.starts_at).slice(0, 16)} — ${m.topic}`).join("\n")}`
      );
    }

    await notifyClient(
      client.id,
      "Your weekly project update",
      `Here's where everything stands:\n\n${sections.join("\n\n")}\n\nSign in to the portal for details.`
    );
    sent++;
  }
  if ((request.headers.get("content-type") || "").includes("form")) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }
  return NextResponse.json({ ok: true, digests_sent: sent });
}
