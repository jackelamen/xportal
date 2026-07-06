import Link from "next/link";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { InfoTip } from "@/components/Tip";
import { activityHref } from "@/lib/activityLink";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const clientsQ = sql(
    `SELECT c.*,
      (SELECT COUNT(*)::int FROM portal_projects p WHERE p.client_id = c.id) AS project_count,
      (SELECT COUNT(*)::int FROM deliverables_approvals d JOIN portal_projects p ON p.id = d.project_id
        WHERE p.client_id = c.id AND d.status = 'Revisions Requested') AS revision_count,
      (SELECT COUNT(*)::int FROM invoices i JOIN portal_projects p ON p.id = i.project_id
        WHERE p.client_id = c.id AND i.status = 'Disputed') AS dispute_count,
      (SELECT COUNT(*)::int FROM deliverables_approvals d JOIN portal_projects p ON p.id = d.project_id
        WHERE p.client_id = c.id AND d.status = 'Pending'
        AND d.submitted_at < (NOW() - INTERVAL '5 days')) AS stale_reviews,
      (SELECT COUNT(*)::int FROM file_requests f JOIN portal_projects p ON p.id = f.project_id
        WHERE p.client_id = c.id AND f.status = 'open') AS open_requests,
      (SELECT MAX(created_at) FROM activity_log a
        WHERE a.client_id = c.id AND a.actor_type = 'client') AS last_client_activity,
      (SELECT COUNT(*)::int FROM communication_threads t JOIN portal_projects p ON p.id = t.project_id
        WHERE p.client_id = c.id AND t.sender_type = 'Client' AND t.operator_read = 0) AS unread_messages
     FROM clients c WHERE c.archived_at IS NULL ORDER BY c.company_name`
  );
  const archivedQ = sql(
    "SELECT id, company_name FROM clients WHERE archived_at IS NOT NULL ORDER BY company_name"
  );
  const bookingsQ = sql(
    `SELECT b.*, c.company_name, u.name AS booked_by FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN client_users u ON u.id = b.client_user_id
     WHERE b.status = 'confirmed' AND b.starts_at > NOW()
     ORDER BY b.starts_at ASC LIMIT 8`
  );
  const activityQ = sql(
    `SELECT a.*, c.company_name FROM activity_log a JOIN clients c ON c.id = a.client_id
     ORDER BY a.created_at DESC LIMIT 12`
  );
  const inboxQ = sql(
    `SELECT a.*, c.company_name FROM activity_log a JOIN clients c ON c.id = a.client_id
     WHERE a.actor_type = 'client'
     ORDER BY a.created_at DESC LIMIT 20`
  );
  const ribbonQ = sql(
    `SELECT
       (SELECT COUNT(*)::int FROM clients WHERE archived_at IS NULL) AS active_clients,
       (SELECT COUNT(*)::int FROM deliverables_approvals WHERE status = 'Pending') AS open_reviews,
       (SELECT COUNT(*)::int FROM deliverables_approvals
         WHERE status = 'Pending' AND submitted_at < NOW() - INTERVAL '5 days') AS stale_reviews,
       (SELECT COUNT(*)::int FROM invoices WHERE status = 'Disputed') AS disputed_invoices,
       (SELECT COUNT(*)::int FROM bookings
         WHERE status = 'confirmed' AND starts_at BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS meetings_this_week`
  );

  const [clients, archivedClients, bookings, activity, inbox, seenSetting, ribbonRows] = await Promise.all([
    clientsQ,
    archivedQ,
    bookingsQ,
    activityQ,
    inboxQ,
    getSettings(["operator_seen_activity_at"]),
    ribbonQ,
  ]);
  const ribbon = ribbonRows[0];

  const seenTs = Date.parse(seenSetting.operator_seen_activity_at) || 0;
  const unseen = inbox.filter((a) => (Date.parse(a.created_at) || 0) > seenTs);

  return (
    <div className="page-enter">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-stretch gap-5 border-b border-line pb-6">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <div>
          <p className="font-data text-[11px] uppercase tracking-widest text-ink-muted">Operator console</p>
          <h1 className="mt-1 text-[1.7rem] leading-none">Dashboard</h1>
        </div>
      </div>

      {/* ── Stat ribbon ──────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 divide-x divide-line rounded-xl border border-line bg-bg-secondary sm:grid-cols-4">
        <Stat label="Active clients" value={clients.length} />
        <Stat
          label="Open reviews"
          value={ribbon.open_reviews}
          note={ribbon.stale_reviews > 0 ? `${ribbon.stale_reviews} stale` : null}
          noteTone="warn"
        />
        <Stat label="Disputed invoices" value={ribbon.disputed_invoices} tone={ribbon.disputed_invoices > 0 ? "danger" : undefined} />
        <Stat label="Meetings this week" value={ribbon.meetings_this_week} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_288px]">
        {/* ── LEFT: notifications + clients ─────────────────────────── */}
        <div className="space-y-6 min-w-0">

          {/* Notifications */}
          <section className="rounded-xl border border-line bg-bg-secondary">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                Notifications
                {unseen.length > 0 && (
                  <span className="font-data rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                    {unseen.length} new
                  </span>
                )}
                <InfoTip side="bottom" text="Client activity since you last cleared. New items are highlighted." />
              </h2>
              {unseen.length > 0 && (
                <form action="/api/admin/notifications" method="post">
                  <input type="hidden" name="_redirect" value="/admin" />
                  <button className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-accent-2/50 hover:text-ink">
                    Mark all read
                  </button>
                </form>
              )}
            </div>
            <ul className="divide-y divide-line/60 text-sm">
              {inbox.length === 0 && (
                <li className="px-5 py-4 text-ink-muted">No client activity yet.</li>
              )}
              {inbox.map((a) => {
                const isNew = (Date.parse(a.created_at) || 0) > seenTs;
                return (
                  <li
                    key={a.id}
                    className={`flex items-start gap-3 px-5 py-3.5 ${isNew ? "bg-accent/5" : ""}`}
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isNew ? "bg-accent" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={activityHref(a, "admin") || `/admin/clients/${a.client_id}`}
                        className={`hover:text-accent ${isNew ? "font-medium text-ink" : "text-ink-soft"}`}
                      >
                        <span className="text-ink-muted">[{a.company_name}]</span> {a.summary}
                      </Link>
                      <p className="font-data mt-0.5 text-xs text-ink-muted">
                        {String(a.created_at).slice(0, 16)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Clients */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 text-[17px]">
                Clients
                <InfoTip side="bottom" text="Health chips: unread messages (blue), stale reviews &gt;5d (amber), open file requests (indigo), last client activity." />
              </h2>
              <span className="font-data text-xs text-ink-muted">{clients.length} active</span>
            </div>
            <div className="mt-3.5 grid gap-3 md:grid-cols-2">
              {clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/clients/${c.id}`}
                  className="group rounded-xl border border-line bg-bg-secondary p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.03)] transition-colors hover:border-accent-2/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-ink transition-colors group-hover:text-accent-2">
                      {c.company_name}
                    </p>
                    <span className="font-data shrink-0 text-[11px] text-ink-muted">
                      {c.project_count} project{c.project_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  {(c.revision_count > 0 || c.dispute_count > 0) && (
                    <p className="mt-1 text-sm">
                      {c.revision_count > 0 && (
                        <span className="text-danger">{c.revision_count} revision{c.revision_count > 1 ? "s" : ""} </span>
                      )}
                      {c.dispute_count > 0 && (
                        <span className="text-dispute">{c.dispute_count} disputed invoice{c.dispute_count > 1 ? "s" : ""}</span>
                      )}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px]">
                    {c.unread_messages > 0 && (
                      <span className="font-data rounded-full bg-accent/12 px-2 py-0.5 font-semibold text-accent">
                        {c.unread_messages} unread
                      </span>
                    )}
                    {c.stale_reviews > 0 && (
                      <span className="font-data rounded-full bg-warn/14 px-2 py-0.5 text-warn">
                        {c.stale_reviews} review{c.stale_reviews > 1 ? "s" : ""} &gt;5d
                      </span>
                    )}
                    {c.open_requests > 0 && (
                      <span className="font-data rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                        {c.open_requests} file request{c.open_requests > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className={`font-data rounded-full px-2 py-0.5 ${
                      c.last_client_activity
                        ? "bg-bg-tertiary text-ink-muted"
                        : "bg-danger/12 text-danger"
                    }`}>
                      {c.last_client_activity
                        ? `active ${String(c.last_client_activity).slice(0, 10)}`
                        : "never active"}
                    </span>
                  </div>
                </Link>
              ))}
              {clients.length === 0 && (
                <p className="text-sm text-ink-muted col-span-2">No clients yet. Add one below.</p>
              )}
            </div>

            <details className="mt-3 rounded-xl border border-line bg-bg-secondary p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-soft hover:text-ink">
                + New client
              </summary>
              <form action="/api/admin/clients" method="post" className="mt-3 flex flex-wrap items-end gap-3 text-sm">
                <input type="hidden" name="_redirect" value="/admin" />
                <Field name="company_name" label="Company" required />
                <Field name="contact_name" label="Contact name" required />
                <Field name="email" label="Contact email" type="email" required />
                <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">
                  Create client
                </button>
              </form>
            </details>

            {archivedClients.length > 0 && (
              <details className="mt-2 rounded-xl border border-line bg-bg-secondary p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink-soft hover:text-ink">
                  Archived ({archivedClients.length})
                </summary>
                <ul className="mt-3 space-y-1.5">
                  {archivedClients.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/admin/clients/${c.id}`} className="truncate text-ink-soft hover:text-ink">
                        {c.company_name}
                      </Link>
                      <form action={`/api/admin/clients/${c.id}`} method="post" className="shrink-0">
                        <input type="hidden" name="_action" value="unarchive" />
                        <input type="hidden" name="_redirect" value="/admin" />
                        <button className="text-xs text-ink-muted hover:text-accent">Unarchive</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        {/* ── RIGHT: meetings, activity, digest ─────────────────────── */}
        <div className="space-y-4">

          {/* Upcoming meetings */}
          <section className="rounded-xl border border-line bg-bg-secondary">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="text-sm font-semibold">Upcoming meetings</h2>
              <Link href="/admin/bookings" className="text-xs text-accent hover:underline">View all</Link>
            </div>
            <ul className="divide-y divide-line/60 text-sm">
              {bookings.length === 0 && (
                <li className="px-4 py-4 text-ink-muted">None scheduled.</li>
              )}
              {bookings.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <p className="font-data text-[10.5px] text-accent-2">{String(b.starts_at).slice(0, 16)}</p>
                  <p className="mt-0.5 font-medium text-ink leading-snug">{b.topic}</p>
                  <p className="text-xs text-ink-muted">
                    {b.company_name}{b.booked_by ? ` · ${b.booked_by}` : ""} · {b.duration_minutes} min
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Weekly digest */}
          <section className="rounded-xl border border-accent-2/30 bg-bg-secondary px-4 py-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.03),0_12px_30px_-18px_rgb(16_185_129_/_0.24)]">
            <h2 className="text-sm font-semibold">Weekly digest</h2>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">
              Emails every client a summary of progress, deliveries, and action items.
            </p>
            <form action="/api/cron/digest" method="post" className="mt-3">
              <button className="w-full rounded-lg bg-accent-2 px-4 py-2 text-sm font-medium text-white">
                Send digests now
              </button>
            </form>
          </section>

          {/* Recent activity */}
          <section className="rounded-xl border border-line bg-bg-secondary">
            <div className="border-b border-line px-4 py-3.5">
              <h2 className="text-sm font-semibold">Recent activity</h2>
            </div>
            <ul className="divide-y divide-line/60 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <p className="text-ink-soft leading-snug">
                    <Link href={`/admin/clients/${a.client_id}`} className="font-medium text-ink hover:text-accent">
                      {a.company_name}
                    </Link>{" "}
                    {a.summary}
                  </p>
                  <p className="font-data mt-0.5 text-xs text-ink-muted">
                    {String(a.created_at).slice(0, 16)}
                  </p>
                </li>
              ))}
              {activity.length === 0 && (
                <li className="px-4 py-4 text-ink-muted">No activity yet.</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note, noteTone = "warn", tone }) {
  return (
    <div className={`px-5 py-4 ${tone === "danger" ? "bg-danger/[0.03]" : ""}`}>
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`font-sans mt-2 text-[2rem] font-semibold leading-none tracking-tight ${tone === "danger" ? "text-danger" : "text-ink"}`}>
        {value}
        {note && (
          <span className={`font-sans ml-1.5 text-xs ${noteTone === "warn" ? "text-warn" : "text-ink-muted"}`}>{note}</span>
        )}
      </p>
    </div>
  );
}

function Field({ name, label, type = "text", required }) {
  return (
    <label className="block text-ink-soft">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 block rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2"
      />
    </label>
  );
}
