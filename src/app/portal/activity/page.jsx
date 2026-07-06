import Link from "next/link";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import {
  FileCheck2, MessageSquare, Receipt, CalendarClock, CircleDot,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { activityHref } from "@/lib/activityLink";

export const dynamic = "force-dynamic";

const ICON = {
  "deliverable.approved": FileCheck2,
  "deliverable.revisions": FileCheck2,
  "deliverable.submitted": FileCheck2,
  "message.sent": MessageSquare,
  "invoice.issued": Receipt,
  "invoice.disputed": Receipt,
  "invoice.paid": Receipt,
  "meeting.requested": CalendarClock,
  "meeting.confirmed": CalendarClock,
  "meeting.countered": CalendarClock,
  "meeting.cancelled": CalendarClock,
};

export default async function ActivityPage() {
  const { user, client } = await getClientSession();
  const locale = user.locale || "en";
  const rows = await sql(
    `SELECT a.*, p.title AS project_title FROM activity_log a
     LEFT JOIN portal_projects p ON p.id = a.project_id
     WHERE a.client_id = ? ORDER BY a.created_at DESC LIMIT 100`,
    [client.id]
  );

  return (
    <div className="page-enter">
      <div className="flex items-stretch gap-4">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <h1 className="text-[1.85rem] leading-none tracking-tight">{t(locale, "activity.title")}</h1>
      </div>
      <ol className="mt-8 space-y-0 border-l border-line pl-5">
        {rows.length === 0 && <p className="text-ink-muted">{t(locale, "activity.empty")}</p>}
        {rows.map((a) => {
          const Icon = ICON[a.event_type] || CircleDot;
          const href = activityHref(a, "client");
          const body = (
            <>
              <p className="text-sm text-ink">{a.summary}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {a.created_at}
                {a.project_title ? ` · ${a.project_title}` : ""}
              </p>
            </>
          );
          return (
            <li key={a.id} className="relative pb-6">
              <span className="absolute -left-[27px] rounded-full border border-line bg-bg-secondary p-1">
                <Icon size={12} className="text-accent" />
              </span>
              {href ? <Link href={href} className="block hover:text-accent">{body}</Link> : body}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
