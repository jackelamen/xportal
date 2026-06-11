import { getBlackoutDates, getWeeklyHours } from "@/lib/calendar";
import { getSettings, INVOICE_SETTING_KEYS } from "@/lib/settings";
import { InfoTip } from "@/components/Tip";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeInput =
  "rounded-lg border border-line bg-bg-tertiary px-2 py-1.5 text-xs text-ink outline-none focus:border-accent-2 disabled:opacity-40";
const area =
  "mt-1 block w-full rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-sm text-ink outline-none focus:border-accent-2";

export default async function AdminSettings() {
  const [hours, blackouts, settings] = await Promise.all([
    getWeeklyHours(),
    getBlackoutDates(),
    getSettings(INVOICE_SETTING_KEYS),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-ink">Settings</h1>

      {/* ── Availability ──────────────────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-bg-secondary p-5">
        <h2 className="flex items-center gap-1.5 font-medium text-ink">
          Availability
          <InfoTip
            side="bottom"
            text="Weekly hours define your default booking window. Date overrides block specific days or time ranges — they take precedence over weekly hours."
          />
        </h2>

        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          {/* Weekly hours */}
          <form action="/api/admin/blackouts" method="post">
            <input type="hidden" name="_action" value="set_hours" />
            <input type="hidden" name="_redirect" value="/admin/settings" />
            <p className="text-xs font-medium text-ink-muted">Weekly hours</p>
            <div className="mt-3 space-y-2 text-sm">
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
                  <input
                    type="time"
                    name={`start_${h.weekday}`}
                    defaultValue={h.start_time}
                    className={`font-data ${timeInput}`}
                  />
                  <span className="text-ink-muted">–</span>
                  <input
                    type="time"
                    name={`end_${h.weekday}`}
                    defaultValue={h.end_time}
                    className={`font-data ${timeInput}`}
                  />
                </div>
              ))}
            </div>
            <button className="mt-4 rounded-lg bg-accent-2 px-4 py-2 text-sm font-medium text-white">
              Save hours
            </button>
          </form>

          {/* Date overrides */}
          <div>
            <p className="text-xs font-medium text-ink-muted">Date overrides</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {blackouts.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-bg-tertiary px-3 py-1.5"
                >
                  <span className="font-data text-xs text-ink">{b.on_date}</span>
                  <span className="font-data text-xs text-danger">
                    {b.start_time || b.end_time
                      ? `${b.start_time || "00:00"} – ${b.end_time || "end of day"}`
                      : "all day"}
                  </span>
                  {b.note && (
                    <span className="truncate text-xs text-ink-muted">{b.note}</span>
                  )}
                  <form action="/api/admin/blackouts" method="post" className="ml-auto">
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="blackout_id" value={b.id} />
                    <input type="hidden" name="_redirect" value="/admin/settings" />
                    <button
                      aria-label={`Remove ${b.on_date} block`}
                      className="px-1 text-ink-muted hover:text-danger"
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
              {blackouts.length === 0 && (
                <li className="text-ink-muted">No overrides — weekly hours apply every week.</li>
              )}
            </ul>
            <form
              action="/api/admin/blackouts"
              method="post"
              className="mt-3 flex flex-wrap items-end gap-2 text-sm"
            >
              <input type="hidden" name="_action" value="add" />
              <input type="hidden" name="_redirect" value="/admin/settings" />
              <label className="block text-ink-soft">
                Date
                <input
                  name="on_date"
                  type="date"
                  required
                  className={`mt-1 block ${timeInput} px-3 py-2 text-sm`}
                />
              </label>
              <label className="block text-ink-soft">
                From
                <input
                  name="start_time"
                  type="time"
                  className={`font-data mt-1 block ${timeInput} py-2`}
                />
              </label>
              <label className="block text-ink-soft">
                To
                <input
                  name="end_time"
                  type="time"
                  className={`font-data mt-1 block ${timeInput} py-2`}
                />
              </label>
              <label className="block text-ink-soft">
                Note
                <input
                  name="note"
                  placeholder="e.g. conference"
                  className={`mt-1 block w-32 ${timeInput} px-3 py-2 text-sm`}
                />
              </label>
              <button className="rounded-lg border border-line px-4 py-2 text-ink-soft hover:text-ink">
                Block date
              </button>
            </form>
            <p className="mt-2 text-xs text-ink-muted">Leave times empty to block the whole day.</p>
          </div>
        </div>
      </section>

      {/* ── Invoice branding ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-bg-secondary p-5">
        <h2 className="flex items-center gap-1.5 font-medium text-ink">
          Invoice branding
          <InfoTip
            side="bottom"
            text="Printed on every invoice PDF: your business identity at the top, payment instructions and footer at the bottom."
          />
        </h2>
        <form
          action="/api/admin/invoice-settings"
          method="post"
          className="mt-4 grid gap-4 text-sm md:grid-cols-2"
        >
          <input type="hidden" name="_redirect" value="/admin/settings" />
          <label className="block text-ink-soft">
            Business name
            <input
              name="invoice_business_name"
              defaultValue={settings.invoice_business_name}
              placeholder="Acme Studio LLC"
              className={area}
            />
          </label>
          <label className="block text-ink-soft">
            Business address
            <textarea
              name="invoice_business_address"
              rows={2}
              defaultValue={settings.invoice_business_address}
              placeholder={"123 Main St\nSpringfield, ST 00000"}
              className={area}
            />
          </label>
          <label className="block text-ink-soft">
            Payment instructions
            <textarea
              name="invoice_payment_instructions"
              rows={2}
              defaultValue={settings.invoice_payment_instructions}
              placeholder="Wire to … / Pay via …"
              className={area}
            />
          </label>
          <label className="block text-ink-soft">
            Footer note
            <textarea
              name="invoice_footer"
              rows={2}
              defaultValue={settings.invoice_footer}
              placeholder="Thank you for your business. Net-15 terms."
              className={area}
            />
          </label>
          <div>
            <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">
              Save invoice branding
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
