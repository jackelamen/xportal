import Link from "next/link";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { InfoTip } from "@/components/Tip";

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

  const [clients, archivedClients, bookings, activity, inbox, seenSetting] = await Promise.all([
    clientsQ,
    archivedQ,
    bookingsQ,
    activityQ,
    inboxQ,
    getSettings(["operator_seen_activity_at"]),
  ]);

  const seenTs = Date.parse(seenSetting.operator_seen_activity_at) || 0;
  const unseen = inbox.filter((a) => (Date.parse(a.created_at) || 0) > seenTs);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_288px]">
      {/* ── LEFT: notifications + clients ───────────────────────────── */}
      <div className="space-y-6 min-w-0">

        {/* Notifications */}
        <section className="rounded-xl border border-line bg-bg-secondary">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-medium text-ink">
              Notifications
              {unseen.length > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
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
                  className={`flex items-start gap-3 px-5 py-3 ${
                    isNew ? "bg-accent/5" : ""
                  }`}
                >
                  {isNew ? (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  ) : (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/clients/${a.client_id}`}
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
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            Clients
            <InfoTip side="bottom" text="Health chips: unread messages (blue), stale reviews &gt;5d (amber), open file requests (indigo), last client activity." />
          </h1>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clients/${c.id}`}
                className="group rounded-xl border border-line bg-bg-secondary p-4 hover:border-accent-2/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink group-hover:text-accent-2 transition-colors">
                    {c.company_name}
                  </p>
                  <span className="shrink-0 text-xs text-ink-muted">
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
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
                  {c.unread_messages > 0 && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">
                      {c.unread_messages} unread
                    </span>
                  )}
                  {c.stale_reviews > 0 && (
                    <span className="rounded-full bg-warn/15 px-2 py-0.5 text-warn">
                      {c.stale_reviews} review{c.stale_reviews > 1 ? "s" : ""} &gt;5d
                    </span>
                  )}
                  {c.open_requests > 0 && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                      {c.open_requests} file request{c.open_requests > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 ${
                    c.last_client_activity
                      ? "bg-bg-tertiary text-ink-muted"
                      : "bg-danger/15 text-danger"
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

          <details className="mt-4 rounded-xl border border-line bg-bg-secondary p-4">
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

      {/* ── RIGHT: meetings, activity, digest ───────────────────────── */}
      <div className="space-y-5">

        {/* Upcoming meetings */}
        <section className="rounded-xl border border-line bg-bg-secondary">
          <div className="border-b border-line px-4 py-3.5">
            <h2 className="font-medium text-ink">Upcoming meetings</h2>
          </div>
          <ul className="divide-y divide-line/60 text-sm">
            {bookings.length === 0 && (
              <li className="px-4 py-4 text-ink-muted">None scheduled.</li>
            )}
            {bookings.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <p className="font-data text-xs text-accent-2">{String(b.starts_at).slice(0, 16)}</p>
                <p className="mt-0.5 font-medium text-ink leading-snug">{b.topic}</p>
                <p className="text-xs text-ink-muted">
                  {b.company_name}{b.booked_by ? ` · ${b.booked_by}` : ""} · {b.duration_minutes} min
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Weekly digest */}
        <section className="rounded-xl border border-line bg-bg-secondary px-4 py-4">
          <h2 className="font-medium text-ink">Weekly digest</h2>
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
            <h2 className="font-medium text-ink">Recent activity</h2>
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
