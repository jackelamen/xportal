import Link from "next/link";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Month grid combining meetings, milestones, and invoice due dates.
export default async function CalendarPage({ searchParams }) {
  const { client } = await getClientSession();

  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp?.y) || now.getFullYear();
  const month = Number(sp?.m) || now.getMonth() + 1; // 1-based

  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startPad = (first.getDay() + 6) % 7; // Monday-first grid
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const events = {};
  const add = (date, ev) => {
    if (date?.startsWith(prefix)) (events[date] ||= []).push(ev);
  };

  const bookings = await sql(
    "SELECT * FROM bookings WHERE client_id = ? AND status = 'confirmed'",
    [client.id]
  );
  for (const b of bookings) {
    add(b.starts_at.slice(0, 10), {
      kind: "meeting",
      label: `${b.starts_at.slice(11, 16)} ${b.topic}`,
    });
  }
  const milestones = await sql(
    `SELECT m.*, p.title AS project_title FROM project_milestones m
     JOIN portal_projects p ON p.id = m.project_id WHERE p.client_id = ? AND p.hidden_from_client = 0`,
    [client.id]
  );
  for (const m of milestones) {
    if (m.kind === "milestone") add(m.starts_on, { kind: "milestone", label: m.title });
    else add(m.ends_on, { kind: "phase-end", label: `${m.title} ends (${m.project_title})` });
  }
  const dueInvoices = await sql(
    `SELECT i.* FROM invoices i JOIN portal_projects p ON p.id = i.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND i.status IN ('Unpaid','Overdue','Disputed')`,
    [client.id]
  );
  for (const i of dueInvoices) {
    add(i.due_date, { kind: "invoice", label: `${i.invoice_number} due` });
  }

  const DOT = {
    meeting: "bg-accent",
    milestone: "bg-warn",
    "phase-end": "bg-accent-2",
    invoice: "bg-danger",
  };

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const monthName = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-stretch gap-4">
          <div className="w-[3px] shrink-0 rounded-full bg-accent" />
          <h1 className="text-[1.6rem] leading-none tracking-tight">{monthName}</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/portal/calendar?y=${prev.y}&m=${prev.m}`} className="rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-ink-soft hover:border-accent hover:text-ink">←</Link>
          <Link href="/portal/calendar" className="rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-ink-soft hover:border-accent hover:text-ink">Today</Link>
          <Link href={`/portal/calendar?y=${next.y}&m=${next.m}`} className="rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-ink-soft hover:border-accent hover:text-ink">→</Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-soft">
        {Object.entries({ meeting: "Meetings", milestone: "Milestones", "phase-end": "Phase ends", invoice: "Invoices due" }).map(
          ([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT[k]}`} /> {label}
            </span>
          )
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-bg-secondary">
        <div className="grid grid-cols-7 border-b border-line bg-bg-tertiary text-center text-xs uppercase tracking-wide text-ink-soft">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-24 border-b border-r border-line/50 bg-bg-primary/30" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = `${prefix}-${String(i + 1).padStart(2, "0")}`;
            const dayEvents = events[date] || [];
            return (
              <div
                key={date}
                className={`min-h-24 border-b border-r border-line/50 p-1.5 ${date === todayStr ? "bg-accent/10" : ""}`}
              >
                <p className={`text-xs ${date === todayStr ? "font-bold text-accent" : "text-ink-muted"}`}>
                  {i + 1}
                </p>
                <div className="mt-1 space-y-1">
                  {dayEvents.map((ev, j) => (
                    <p key={j} className="flex items-start gap-1 text-[10px] leading-tight text-ink-soft" title={ev.label}>
                      <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[ev.kind]}`} />
                      <span className="truncate">{ev.label}</span>
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
