import Link from "next/link";
import {
  FileCheck2, Receipt, CalendarClock, MessageSquare, Inbox, ArrowRight, CalendarPlus,
} from "lucide-react";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { InfoTip } from "@/components/Tip";
import { phaseLabel } from "@/lib/phases";

export const dynamic = "force-dynamic";

const fmtDate = (s) =>
  s ? new Date(s + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

export default async function Home() {
  const { user, client } = await getClientSession();

  const projectsQ = sql(
    "SELECT * FROM portal_projects WHERE client_id = ? AND hidden_from_client = 0 ORDER BY updated_at DESC",
    [client.id]
  );
  // One query for all phases across the client's projects, grouped in JS.
  const phasesQ = sql(
    `SELECT m.* FROM project_milestones m JOIN portal_projects p ON p.id = m.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND m.kind = 'phase'
     ORDER BY m.sort_order`,
    [client.id]
  );

  // Attention items: the reason the client logged in.
  const pendingQ = sql(
    `SELECT d.id, d.title, p.id AS project_id, p.title AS project_title
     FROM deliverables_approvals d JOIN portal_projects p ON p.id = d.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND d.status = 'Pending' ORDER BY d.submitted_at ASC`,
    [client.id]
  );
  const openInvoicesQ = sql(
    `SELECT i.* FROM invoices i JOIN portal_projects p ON p.id = i.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND i.status IN ('Unpaid','Overdue') ORDER BY i.due_date ASC`,
    [client.id]
  );
  // The earliest unread message per project, so the attention link can jump
  // straight to where the catching-up starts.
  const unreadByProjectQ = sql(
    `SELECT p.id AS project_id, p.title AS project_title, COUNT(*)::int AS n,
       (array_agg(t.id ORDER BY t.created_at ASC))[1] AS first_unread_id,
       (array_agg(t.sender_name ORDER BY t.created_at ASC))[1] AS first_sender,
       MIN(t.created_at) AS first_at
     FROM communication_threads t JOIN portal_projects p ON p.id = t.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND t.sender_type = 'Internal_Operator' AND t.is_read = 0
     GROUP BY p.id, p.title ORDER BY first_at DESC`,
    [client.id]
  );
  const nextMeetingQ = sql(
    `SELECT * FROM bookings WHERE client_id = ? AND status = 'confirmed' AND starts_at > NOW()
     ORDER BY starts_at ASC LIMIT 1`,
    [client.id]
  );
  const openRequestsQ = sql(
    `SELECT f.title, p.id AS project_id, p.title AS project_title
     FROM file_requests f JOIN portal_projects p ON p.id = f.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND f.status = 'open' ORDER BY f.created_at ASC`,
    [client.id]
  );
  const recentActivityQ = sql(
    `SELECT * FROM activity_log WHERE client_id = ? AND actor_type = 'operator'
     ORDER BY created_at DESC LIMIT 5`,
    [client.id]
  );

  const [projects, phases, pending, openInvoices, unreadByProject, nextMeetings, openRequests, recentActivity] =
    await Promise.all([projectsQ, phasesQ, pendingQ, openInvoicesQ, unreadByProjectQ, nextMeetingQ, openRequestsQ, recentActivityQ]);
  const nextMeeting = nextMeetings[0];
  const phasesByProject = {};
  for (const m of phases) (phasesByProject[m.project_id] ||= []).push(m);

  const unreadMap = Object.fromEntries(unreadByProject.map((m) => [m.project_id, m.n]));

  const attention = [
    ...openRequests.map((f) => ({
      icon: Inbox,
      href: `/portal/projects/${f.project_id}?tab=documents`,
      text: `We need a file from you: "${f.title}" (${f.project_title})`,
    })),
    ...pending.map((d) => ({
      icon: FileCheck2,
      href: `/portal/projects/${d.project_id}?tab=deliverables`,
      text: `"${d.title}" is awaiting your review (${d.project_title})`,
    })),
    ...openInvoices.map((i) => ({
      icon: Receipt,
      href: "/portal/billing",
      text: `Invoice ${i.invoice_number} ($${Number(i.amount).toFixed(2)}) due ${i.due_date}`,
    })),
    ...unreadByProject.map((m) => ({
      icon: MessageSquare,
      href: `/portal/projects/${m.project_id}?tab=messages#msg-${m.first_unread_id}`,
      text: `${m.n} new message${m.n > 1 ? "s" : ""} from ${m.first_sender || "the team"} (${m.project_title})`,
    })),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="font-data text-xs text-ink-muted">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {attention.length > 0 ? (
        <section className="mt-6 rounded-xl border border-accent/40 bg-accent/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Needs your attention
            <span className="font-data text-xs font-normal text-ink-muted">({attention.length})</span>
            <InfoTip side="bottom" text="Everything waiting on an action from you — files to upload, work to review, invoices, and new messages. Click any item to jump straight to it." />
          </h2>
          <ul className="mt-4 space-y-2">
            {attention.map((a, i) => (
              <li key={i}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3 rounded-lg border border-line bg-bg-secondary px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <a.icon size={15} />
                  </span>
                  <span className="min-w-0 truncate group-hover:text-accent">{a.text}</span>
                  <ArrowRight
                    size={15}
                    className="ml-auto shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 rounded-xl border border-line bg-bg-secondary p-5 text-sm text-ink-soft">
          You're all caught up — nothing needs your attention right now.
        </p>
      )}

      <h2 className="mt-10 text-lg font-medium">Your projects</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {projects.length === 0 && (
          <p className="text-ink-soft">No active projects yet — your workspace is ready for kickoff.</p>
        )}
        {projects.map((p) => {
          const phases = phasesByProject[p.id] || [];
          const activeIdx = phases.findIndex((ph) => ph.status === "active");
          const active = activeIdx >= 0 ? phases[activeIdx] : null;
          const blocked = phases.find((ph) => ph.status === "blocked");
          return (
            // Stretched-link card: the title link covers the whole card; the
            // message chip sits above it (z-10) with its own destination.
            <div
              key={p.id}
              className="group relative rounded-xl border border-line bg-bg-secondary p-5 transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                  <Link href={`/portal/projects/${p.id}`} className="truncate after:absolute after:inset-0">
                    {p.title}
                  </Link>
                  {unreadMap[p.id] > 0 && (
                    <Link
                      href={`/portal/projects/${p.id}?tab=messages`}
                      className="relative z-10 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      {unreadMap[p.id]} new
                    </Link>
                  )}
                </h3>
                <ArrowRight size={15} className="mt-1 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>

              <p className="mt-2 text-sm">
                {blocked ? (
                  <span className="font-medium text-danger">Blocked: {phaseLabel(phases.indexOf(blocked), blocked.title)}</span>
                ) : (
                  <>
                    <span className="font-medium text-accent">{active ? phaseLabel(activeIdx, active.title) : p.current_phase}</span>
                    <span className="text-ink-muted">
                      {active ? ` · ${activeIdx + 1} of ${phases.length}` : ""}
                      {active?.ends_on ? ` · through ${fmtDate(active.ends_on)}` : ""}
                    </span>
                  </>
                )}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${p.progress_percentage}%` }} />
                </div>
                <span className="font-data text-xs font-medium text-ink-soft">{p.progress_percentage}%</span>
              </div>

              <p className="font-data mt-3 text-[11px] text-ink-muted">target {p.target_date || "TBD"}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-bg-secondary p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarClock size={15} className="text-accent" /> Next meeting
          </h2>
          {nextMeeting ? (
            <div className="mt-3 text-sm">
              <p className="font-medium text-ink">{nextMeeting.topic}</p>
              <p className="font-data mt-1 text-xs text-ink-soft">
                {nextMeeting.starts_at.slice(0, 16)} · {nextMeeting.duration_minutes} min
              </p>
              <Link href="/portal/schedule" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                Manage meetings <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="mt-3 text-sm text-ink-soft">
              <p>Nothing scheduled.</p>
              <Link
                href="/portal/schedule"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-soft hover:border-accent hover:text-ink"
              >
                <CalendarPlus size={13} /> Book a meeting
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-bg-secondary p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            Latest from the team
            <InfoTip text="The most recent things we've done across your projects — uploads, status changes, file requests, and messages." />
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recentActivity.length === 0 && <li className="text-ink-muted">No recent updates.</li>}
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2">
                <span className="font-data shrink-0 text-[11px] text-ink-muted">{a.created_at.slice(5, 10)}</span>
                <span className="min-w-0 truncate text-ink-soft">{a.summary}</span>
              </li>
            ))}
          </ul>
          <Link href="/portal/activity" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Full activity history <ArrowRight size={12} />
          </Link>
        </section>
      </div>
    </div>
  );
}
