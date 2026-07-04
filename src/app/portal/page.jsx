import Link from "next/link";
import {
  FileCheck2, Receipt, CalendarClock, MessageSquare, Inbox, ArrowRight, CalendarPlus,
} from "lucide-react";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { phaseLabel } from "@/lib/phases";
import { t, formatDate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user, client } = await getClientSession();
  const locale = user.locale || "en";
  const fmtDate = (s) => (s ? formatDate(locale, s, { month: "short", day: "numeric" }) : null);

  const projectsQ = sql(
    "SELECT * FROM portal_projects WHERE client_id = ? AND hidden_from_client = 0 AND archived_at IS NULL ORDER BY updated_at DESC",
    [client.id]
  );
  // One query for all phases across the client's projects, grouped in JS.
  const phasesQ = sql(
    `SELECT m.* FROM project_milestones m JOIN portal_projects p ON p.id = m.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND p.archived_at IS NULL AND m.kind = 'phase'
     ORDER BY m.sort_order`,
    [client.id]
  );

  // Attention items: the reason the client logged in.
  const pendingQ = sql(
    `SELECT d.id, d.title, p.id AS project_id, p.title AS project_title
     FROM deliverables_approvals d JOIN portal_projects p ON p.id = d.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND p.archived_at IS NULL AND d.status = 'Pending' ORDER BY d.submitted_at ASC`,
    [client.id]
  );
  const openInvoicesQ = sql(
    `SELECT i.* FROM invoices i JOIN portal_projects p ON p.id = i.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND p.archived_at IS NULL AND i.status IN ('Unpaid','Overdue') ORDER BY i.due_date ASC`,
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
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND p.archived_at IS NULL AND t.sender_type = 'Internal_Operator' AND t.is_read = 0
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
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND p.archived_at IS NULL AND f.status = 'open' ORDER BY f.created_at ASC`,
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
      text: t(locale, "home.attentionFileRequest", { title: f.title, project: f.project_title }),
    })),
    ...pending.map((d) => ({
      icon: FileCheck2,
      href: `/portal/projects/${d.project_id}?tab=deliverables`,
      text: t(locale, "home.attentionDeliverable", { title: d.title, project: d.project_title }),
    })),
    ...openInvoices.map((i) => ({
      icon: Receipt,
      href: "/portal/billing",
      text: t(locale, "home.attentionInvoice", { number: i.invoice_number, amount: formatMoney(i.amount, i.currency, locale), date: i.due_date }),
    })),
    ...unreadByProject.map((m) => ({
      icon: MessageSquare,
      href: `/portal/projects/${m.project_id}?tab=messages#msg-${m.first_unread_id}`,
      text: t(locale, "home.attentionMessages", {
        n: m.n,
        plural: m.n > 1 ? "s" : "",
        sender: m.first_sender || t(locale, "home.attentionMessagesFallback"),
        project: m.project_title,
      }),
    })),
  ];

  return (
    <div className="page-enter">
      <div className="flex items-stretch gap-5 border-b border-line pb-6">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <div>
          <p className="font-data text-[11px] uppercase tracking-widest text-ink-muted">
            {formatDate(locale, new Date().toISOString().slice(0, 10), { weekday: "long", month: "long", day: "numeric" })}
            {"  ·  "}{client.company_name}
          </p>
          <h1 className="mt-1 text-[1.85rem] leading-none tracking-tight">
            {t(locale, "home.greeting", { name: user.name.split(" ")[0] })}
          </h1>
        </div>
      </div>

      {attention.length > 0 ? (
        <section className="mt-6 rounded-xl border border-accent/40 bg-accent/5 p-5">
          <h2 className="flex items-center gap-2.5 text-sm font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent ring-4 ring-accent/15" />
            {t(locale, "home.needsAttention")}
            <span className="font-data text-xs font-normal text-ink-muted">({attention.length})</span>
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
          {t(locale, "home.allCaughtUp")}
        </p>
      )}

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-[19px]">{t(locale, "home.yourProjects")}</h2>
        <span className="font-data text-xs text-ink-muted">{t(locale, "home.activeCount", { n: projects.length })}</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {projects.length === 0 && (
          <p className="text-ink-soft">{t(locale, "home.noProjects")}</p>
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
              className="group relative rounded-xl border border-line bg-bg-secondary p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.03),0_12px_30px_-16px_rgb(0_0_0_/_0.13)] transition-all hover:-translate-y-0.5 hover:border-accent"
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
                      {t(locale, "home.newBadge", { n: unreadMap[p.id] })}
                    </Link>
                  )}
                </h3>
                <ArrowRight size={15} className="mt-1 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>

              <p className="mt-2 text-sm">
                {blocked ? (
                  <span className="font-medium text-danger">{t(locale, "home.blocked", { phase: phaseLabel(phases.indexOf(blocked), blocked.title) })}</span>
                ) : (
                  <>
                    <span className="font-medium text-accent">{active ? phaseLabel(activeIdx, active.title) : p.current_phase}</span>
                    <span className="text-ink-muted">
                      {active ? t(locale, "home.ofTotal", { idx: activeIdx + 1, total: phases.length }) : ""}
                      {active?.ends_on ? t(locale, "home.through", { date: fmtDate(active.ends_on) }) : ""}
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

              <p className="font-data mt-3 text-[11px] text-ink-muted">
                {p.target_date ? t(locale, "home.targetDate", { date: p.target_date }) : t(locale, "home.targetTbd")}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-bg-secondary p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarClock size={15} className="text-accent" /> {t(locale, "home.nextMeeting")}
          </h2>
          {nextMeeting ? (
            <div className="mt-3 text-sm">
              <p className="font-medium text-ink">{nextMeeting.topic}</p>
              <p className="font-data mt-1 text-xs text-ink-soft">
                {nextMeeting.starts_at.slice(0, 16)} · {t(locale, "schedule.minutes", { n: nextMeeting.duration_minutes })}
              </p>
              <Link href="/portal/schedule" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                {t(locale, "home.manageMeetings")} <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="mt-3 text-sm text-ink-soft">
              <p>{t(locale, "home.nothingScheduled")}</p>
              <Link
                href="/portal/schedule"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-soft hover:border-accent hover:text-ink"
              >
                <CalendarPlus size={13} /> {t(locale, "home.bookMeeting")}
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-bg-secondary p-5">
          <h2 className="text-sm font-semibold text-ink">{t(locale, "home.latestFromTeam")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recentActivity.length === 0 && <li className="text-ink-muted">{t(locale, "home.noRecentUpdates")}</li>}
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2">
                <span className="font-data shrink-0 text-[11px] text-ink-muted">{a.created_at.slice(5, 10)}</span>
                <span className="min-w-0 truncate text-ink-soft">{a.summary}</span>
              </li>
            ))}
          </ul>
          <Link href="/portal/activity" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
            {t(locale, "home.fullActivityHistory")} <ArrowRight size={12} />
          </Link>
        </section>
      </div>
    </div>
  );
}
