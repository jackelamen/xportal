import Link from "next/link";
import { getDb } from "@/lib/db";
import { getBlackoutDates, getWeeklyHours } from "@/lib/calendar";
import { getSettings, INVOICE_SETTING_KEYS } from "@/lib/settings";
import { InfoTip } from "@/components/Tip";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const db = getDb();
  const clients = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM portal_projects p WHERE p.client_id = c.id) AS project_count,
        (SELECT COUNT(*) FROM deliverables_approvals d JOIN portal_projects p ON p.id = d.project_id
          WHERE p.client_id = c.id AND d.status = 'Revisions Requested') AS revision_count,
        (SELECT COUNT(*) FROM invoices i JOIN portal_projects p ON p.id = i.project_id
          WHERE p.client_id = c.id AND i.status = 'Disputed') AS dispute_count,
        (SELECT COUNT(*) FROM deliverables_approvals d JOIN portal_projects p ON p.id = d.project_id
          WHERE p.client_id = c.id AND d.status = 'Pending'
          AND d.submitted_at < datetime('now', '-5 days')) AS stale_reviews,
        (SELECT COUNT(*) FROM file_requests f JOIN portal_projects p ON p.id = f.project_id
          WHERE p.client_id = c.id AND f.status = 'open') AS open_requests,
        (SELECT MAX(created_at) FROM activity_log a
          WHERE a.client_id = c.id AND a.actor_type = 'client') AS last_client_activity,
        (SELECT COUNT(*) FROM communication_threads t JOIN portal_projects p ON p.id = t.project_id
          WHERE p.client_id = c.id AND t.sender_type = 'Client' AND t.operator_read = 0) AS unread_messages
       FROM clients c ORDER BY c.company_name`
    )
    .all();
  const bookings = db
    .prepare(
      `SELECT b.*, c.company_name, u.name AS booked_by FROM bookings b
       JOIN clients c ON c.id = b.client_id
       LEFT JOIN client_users u ON u.id = b.client_user_id
       WHERE b.status = 'confirmed' AND b.starts_at > datetime('now')
       ORDER BY b.starts_at ASC LIMIT 10`
    )
    .all();
  const activity = db
    .prepare(
      `SELECT a.*, c.company_name FROM activity_log a JOIN clients c ON c.id = a.client_id
       ORDER BY a.created_at DESC LIMIT 15`
    )
    .all();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="flex items-center gap-2 text-xl font-semibold">Clients <InfoTip side="bottom" text="One card per client. The chips are health signals: unread messages, reviews sitting more than 5 days, open file requests, and how recently the client was active." /></h1>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
              className="rounded-xl border border-line bg-bg-secondary p-4 hover:border-accent-2"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{c.company_name}</p>
                <span className="text-xs text-ink-muted">/p/{c.slug || "—"}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {c.project_count} project{c.project_count === 1 ? "" : "s"}
                {c.revision_count > 0 && (
                  <span className="ml-2 text-danger">{c.revision_count} revision request{c.revision_count > 1 ? "s" : ""}</span>
                )}
                {c.dispute_count > 0 && (
                  <span className="ml-2 text-dispute">{c.dispute_count} disputed invoice{c.dispute_count > 1 ? "s" : ""}</span>
                )}
              </p>
              <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                {c.unread_messages > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-white">
                    {c.unread_messages} unread message{c.unread_messages > 1 ? "s" : ""}
                  </span>
                )}
                {c.stale_reviews > 0 && (
                  <span className="rounded-full bg-warn/15 px-2 py-0.5 text-warn">
                    {c.stale_reviews} review{c.stale_reviews > 1 ? "s" : ""} sitting &gt;5d
                  </span>
                )}
                {c.open_requests > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
                    {c.open_requests} open file request{c.open_requests > 1 ? "s" : ""}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 ${
                  c.last_client_activity ? "bg-bg-tertiary text-ink-muted" : "bg-danger/15 text-danger"
                }`}>
                  {c.last_client_activity
                    ? `last client activity ${c.last_client_activity.slice(0, 10)}`
                    : "client never active"}
                </span>
              </p>
            </Link>
          ))}
        </div>

        <details className="mt-4 rounded-xl border border-line bg-bg-secondary p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">+ New client</summary>
          <form action="/api/admin/clients" method="post" className="mt-3 flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="_redirect" value="/admin" />
            <Field name="company_name" label="Company" required />
            <Field name="contact_name" label="Contact name" required />
            <Field name="email" label="Contact email" type="email" required />
            <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Create</button>
          </form>
        </details>
      </section>

      <Availability hours={getWeeklyHours()} blackouts={getBlackoutDates()} />

      <section>
        <h2 className="text-lg font-medium">Upcoming meetings</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {bookings.length === 0 && <li className="text-ink-muted">None scheduled.</li>}
          {bookings.map((b) => (
            <li key={b.id} className="text-ink-soft">
              <span className="font-data text-ink">{b.starts_at.slice(0, 16)}</span> · {b.topic} ({b.duration_minutes} min)
              — {b.company_name}{b.booked_by ? `, ${b.booked_by}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-bg-secondary p-4">
        <form action="/api/cron/digest" method="post" className="flex items-center justify-between text-sm">
          <p className="text-ink-soft">
            Weekly digest — emails every client a summary of progress, deliveries, and what's waiting on them.
            <span className="block text-xs text-ink-muted">Phase 2: schedule this via Vercel Cron.</span>
          </p>
          <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Send digests now</button>
        </form>
      </section>

      <InvoiceSettings settings={getSettings(INVOICE_SETTING_KEYS)} />

      <section>
        <h2 className="text-lg font-medium">Recent activity</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {activity.map((a) => (
            <li key={a.id} className="text-ink-soft">
              <span className="font-data text-xs text-ink-muted">{a.created_at}</span> · [{a.company_name}] {a.summary}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeInput =
  "rounded-lg border border-line bg-bg-tertiary px-2 py-1.5 text-xs text-ink outline-none focus:border-accent-2 disabled:opacity-40";

function Availability({ hours, blackouts }) {
  return (
    <section className="rounded-xl border border-line bg-bg-secondary p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        Availability
        <InfoTip side="bottom" text="Weekly hours are the default window clients can book meetings in. Date overrides block specific days entirely or for a time range — they win over weekly hours." />
      </h2>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        {/* Default weekly hours, Calendly-style */}
        <form action="/api/admin/blackouts" method="post">
          <input type="hidden" name="_action" value="set_hours" />
          <input type="hidden" name="_redirect" value="/admin" />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Weekly hours</p>
          <div className="mt-2 space-y-1.5 text-sm">
            {hours.map((h) => (
              <div key={h.weekday} className="flex items-center gap-3">
                <label className="flex w-28 items-center gap-2 text-ink">
                  <input
                    type="checkbox"
                    name={`enabled_${h.weekday}`}
                    defaultChecked={!!h.enabled}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  {DAY_NAMES[h.weekday]}
                </label>
                <input type="time" name={`start_${h.weekday}`} defaultValue={h.start_time} className={`font-data ${timeInput}`} />
                <span className="text-ink-muted">–</span>
                <input type="time" name={`end_${h.weekday}`} defaultValue={h.end_time} className={`font-data ${timeInput}`} />
              </div>
            ))}
          </div>
          <button className="mt-3 rounded-lg bg-accent-2 px-4 py-2 text-sm font-medium text-white">
            Save weekly hours
          </button>
        </form>

        {/* Date-specific overrides */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Date overrides</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {blackouts.map((b) => (
              <li key={b.id} className="flex items-center gap-2 rounded-lg border border-line bg-bg-tertiary px-3 py-1.5">
                <span className="font-data text-xs text-ink">{b.on_date}</span>
                <span className="font-data text-xs text-danger">
                  {b.start_time || b.end_time
                    ? `${b.start_time || "00:00"} – ${b.end_time || "end of day"}`
                    : "all day"}
                </span>
                {b.note && <span className="truncate text-xs text-ink-muted">{b.note}</span>}
                <form action="/api/admin/blackouts" method="post" className="ml-auto">
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="blackout_id" value={b.id} />
                  <input type="hidden" name="_redirect" value="/admin" />
                  <button aria-label={`Remove ${b.on_date} block`} className="px-1 text-ink-muted hover:text-danger">×</button>
                </form>
              </li>
            ))}
            {blackouts.length === 0 && (
              <li className="text-ink-muted">No overrides — weekly hours apply every week.</li>
            )}
          </ul>
          <form action="/api/admin/blackouts" method="post" className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="_action" value="add" />
            <input type="hidden" name="_redirect" value="/admin" />
            <label className="block text-ink-soft">
              Date
              <input name="on_date" type="date" required className={`mt-1 block ${timeInput} px-3 py-2 text-sm`} />
            </label>
            <label className="block text-ink-soft">
              From
              <input name="start_time" type="time" className={`font-data mt-1 block ${timeInput} py-2`} />
            </label>
            <label className="block text-ink-soft">
              To
              <input name="end_time" type="time" className={`font-data mt-1 block ${timeInput} py-2`} />
            </label>
            <label className="block text-ink-soft">
              Note
              <input name="note" placeholder="e.g. conference" className={`mt-1 block w-32 ${timeInput} px-3 py-2 text-sm`} />
            </label>
            <button className="rounded-lg border border-line px-4 py-2 text-ink-soft hover:text-ink">Block</button>
          </form>
          <p className="mt-2 text-xs text-ink-muted">Leave the times empty to block the whole day.</p>
        </div>
      </div>
    </section>
  );
}

function InvoiceSettings({ settings }) {
  const area =
    "mt-1 block w-full rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-sm text-ink outline-none focus:border-accent-2";
  return (
    <section className="rounded-xl border border-line bg-bg-secondary p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        Invoice branding
        <InfoTip side="bottom" text="Printed on every invoice PDF clients download: your business identity at the top, payment instructions and footer at the bottom." />
      </h2>
      <form action="/api/admin/invoice-settings" method="post" className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <input type="hidden" name="_redirect" value="/admin" />
        <label className="block text-ink-soft">
          Business name
          <input name="invoice_business_name" defaultValue={settings.invoice_business_name} placeholder="Acme Studio LLC" className={area} />
        </label>
        <label className="block text-ink-soft">
          Business address
          <textarea name="invoice_business_address" rows={2} defaultValue={settings.invoice_business_address} placeholder={"123 Main St\nSpringfield, ST 00000"} className={area} />
        </label>
        <label className="block text-ink-soft">
          Payment instructions
          <textarea name="invoice_payment_instructions" rows={2} defaultValue={settings.invoice_payment_instructions} placeholder={"Wire to … / Pay via …"} className={area} />
        </label>
        <label className="block text-ink-soft">
          Footer note
          <textarea name="invoice_footer" rows={2} defaultValue={settings.invoice_footer} placeholder="Thank you for your business. Net-15 terms." className={area} />
        </label>
        <div>
          <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Save invoice branding</button>
        </div>
      </form>
    </section>
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
