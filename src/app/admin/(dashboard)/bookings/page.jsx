import { sql } from "@/lib/db";
import { getAvailableSlots } from "@/lib/calendar";
import { InfoTip } from "@/components/Tip";

export const dynamic = "force-dynamic";

const HERE = "/admin/bookings";

const JOIN = `
  SELECT b.*, c.company_name, u.name AS booked_by FROM bookings b
  JOIN clients c ON c.id = b.client_id
  LEFT JOIN client_users u ON u.id = b.client_user_id
`;

export default async function AdminBookings() {
  const [needsResponse, waitingOnClient, upcoming] = await Promise.all([
    sql(`${JOIN} WHERE b.status = 'pending' AND b.proposed_by = 'client' ORDER BY b.starts_at ASC`),
    sql(`${JOIN} WHERE b.status = 'pending' AND b.proposed_by = 'operator' ORDER BY b.starts_at ASC`),
    sql(`${JOIN} WHERE b.status = 'confirmed' AND b.starts_at > NOW() ORDER BY b.starts_at ASC`),
  ]);

  // Slot options for each "needs your response" row's counter-proposal
  // picker, computed at the same duration the client asked for.
  const slotsByBooking = Object.fromEntries(
    await Promise.all(
      needsResponse.map(async (b) => [b.id, await getAvailableSlots(b.duration_minutes, b.id)])
    )
  );

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-stretch gap-4">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <div>
          <p className="font-data text-[11px] uppercase tracking-widest text-ink-muted">Operator console</p>
          <h1 className="mt-1 text-[1.5rem] leading-none text-ink">Bookings</h1>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-bg-secondary p-5">
        <h2 className="flex items-center gap-1.5 font-medium text-ink">
          Needs your response
          <InfoTip side="bottom" text="Meeting requests, or client counter-proposals, waiting on you. Accept, or suggest a different time - the client is notified either way." />
        </h2>
        {needsResponse.length === 0 && <p className="mt-3 text-sm text-ink-muted">Nothing waiting on you.</p>}
        <div className="mt-3 space-y-3">
          {needsResponse.map((b) => (
            <div key={b.id} className="rounded-lg border border-line bg-bg-primary p-4">
              <p className="font-medium text-ink">{b.topic}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {b.company_name}{b.booked_by ? ` · ${b.booked_by}` : ""} · {b.duration_minutes} min
              </p>
              <p className="font-data mt-1.5 text-sm text-accent-2">Proposed: {String(b.starts_at).slice(0, 16)}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action="/api/admin/bookings" method="post">
                  <input type="hidden" name="_action" value="accept" />
                  <input type="hidden" name="booking_id" value={b.id} />
                  <input type="hidden" name="_redirect" value={HERE} />
                  <button className="rounded-lg bg-accent-2 px-3 py-1.5 text-xs font-medium text-white">Accept</button>
                </form>

                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-accent-2 hover:text-ink">
                    Suggest a different time
                  </summary>
                  <form
                    action="/api/admin/bookings"
                    method="post"
                    className="mt-2 flex w-72 flex-col gap-2 rounded-lg border border-line bg-bg-tertiary p-3"
                  >
                    <input type="hidden" name="_action" value="counter" />
                    <input type="hidden" name="booking_id" value={b.id} />
                    <input type="hidden" name="duration_minutes" value={b.duration_minutes} />
                    <input type="hidden" name="_redirect" value={HERE} />
                    <select
                      name="starts_at"
                      required
                      className="rounded-lg border border-line bg-bg-secondary px-2 py-1.5 text-sm text-ink outline-none focus:border-accent-2"
                    >
                      {(slotsByBooking[b.id] || []).length === 0 && <option value="">No open slots in the next 14 days</option>}
                      {(slotsByBooking[b.id] || []).map((s) => (
                        <option key={s} value={s}>{s.slice(0, 16)}</option>
                      ))}
                    </select>
                    <button
                      disabled={(slotsByBooking[b.id] || []).length === 0}
                      className="self-start rounded-lg bg-accent-2 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Propose this time
                    </button>
                  </form>
                </details>

                <details className="relative">
                  <summary className="cursor-pointer list-none text-xs text-ink-muted hover:text-danger">Cancel</summary>
                  <form
                    action="/api/admin/bookings"
                    method="post"
                    className="mt-2 flex w-72 flex-col gap-2 rounded-lg border border-line bg-bg-tertiary p-3"
                  >
                    <input type="hidden" name="_action" value="cancel" />
                    <input type="hidden" name="booking_id" value={b.id} />
                    <input type="hidden" name="_redirect" value={HERE} />
                    <textarea
                      name="reason"
                      required
                      rows={2}
                      placeholder="Reason for cancelling"
                      className="rounded-lg border border-line bg-bg-secondary px-2 py-1.5 text-sm text-ink outline-none focus:border-danger"
                    />
                    <button className="self-start rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white">
                      Confirm cancellation
                    </button>
                  </form>
                </details>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-bg-secondary p-5">
        <h2 className="font-medium text-ink">Waiting on client</h2>
        {waitingOnClient.length === 0 && <p className="mt-3 text-sm text-ink-muted">Nothing waiting on the client.</p>}
        <ul className="mt-3 divide-y divide-line/70 text-sm">
          {waitingOnClient.map((b) => (
            <li key={b.id} className="py-2.5">
              <p className="font-medium text-ink">{b.topic}</p>
              <p className="text-xs text-ink-muted">
                {b.company_name}{b.booked_by ? ` · ${b.booked_by}` : ""} · {b.duration_minutes} min
              </p>
              <p className="font-data mt-1 text-xs text-ink-soft">You proposed: {String(b.starts_at).slice(0, 16)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-bg-secondary p-5">
        <h2 className="font-medium text-ink">Upcoming confirmed</h2>
        {upcoming.length === 0 && <p className="mt-3 text-sm text-ink-muted">None scheduled.</p>}
        <div className="mt-3 space-y-2">
          {upcoming.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-bg-primary px-3.5 py-2.5 text-sm">
              <span className="font-data text-[10.5px] text-accent-2">{String(b.starts_at).slice(0, 16)}</span>
              <span className="font-medium text-ink">{b.topic}</span>
              <span className="text-xs text-ink-muted">
                {b.company_name}{b.booked_by ? ` · ${b.booked_by}` : ""} · {b.duration_minutes} min
              </span>
              <details className="relative ml-auto">
                <summary className="cursor-pointer list-none text-xs text-ink-muted hover:text-danger">Cancel</summary>
                <form
                  action="/api/admin/bookings"
                  method="post"
                  className="absolute right-0 mt-2 flex w-72 flex-col gap-2 rounded-lg border border-line bg-bg-tertiary p-3 shadow-lg"
                >
                  <input type="hidden" name="_action" value="cancel" />
                  <input type="hidden" name="booking_id" value={b.id} />
                  <input type="hidden" name="_redirect" value={HERE} />
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    placeholder="Reason for cancelling"
                    className="rounded-lg border border-line bg-bg-secondary px-2 py-1.5 text-sm text-ink outline-none focus:border-danger"
                  />
                  <button className="self-start rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white">
                    Confirm cancellation
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
