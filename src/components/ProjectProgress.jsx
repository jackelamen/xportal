import {
  Check, Dot, CalendarClock, Receipt, Flag, Diamond, Activity as ActivityIcon,
} from "lucide-react";
import { numberPhases, phaseLabel } from "@/lib/phases";
import { InfoTip } from "@/components/Tip";
import { t as translate, formatDate } from "@/lib/i18n";

// Replaces the old horizontal Gantt. Two stacked, mobile-friendly views:
//  1. Journey  - the phases as a vertical stepper (done / in-progress / blocked
//     / upcoming), the active phase carrying a live countdown, with point
//     milestones nested under the phase whose date range contains them.
//  2. Pulse    - what has happened on this project (recent activity) and what's
//     coming up next (upcoming milestones, phase wrap-ups, meetings, invoices).

const dayMs = 86_400_000;
const dateOnly = (s) => (s || "").slice(0, 10);

const STEP = {
  done: { dot: "bg-accent-2 text-white", line: "bg-accent-2/50", label: "progress.statusDone", labelColor: "text-ink-soft" },
  active: { dot: "bg-accent text-white ring-4 ring-accent/15", line: "bg-line", label: "progress.statusActive", labelColor: "text-accent" },
  blocked: { dot: "bg-danger text-white ring-4 ring-danger/15", line: "bg-line", label: "progress.statusBlocked", labelColor: "text-danger" },
  upcoming: { dot: "bg-bg-tertiary text-ink-muted", line: "bg-line", label: "progress.statusUpcoming", labelColor: "text-ink-muted" },
};

export default function ProjectProgress({ milestones, activity, nextMeeting, dueInvoices, locale = "en" }) {
  const t = (key, vars) => translate(locale, key, vars);
  const fmt = (s) => (s ? formatDate(locale, s, { month: "short", day: "numeric" }) : null);
  const fmtFull = (s) => (s ? formatDate(locale, s, { month: "short", day: "numeric", year: "numeric" }) : null);

  const numbered = numberPhases(milestones);
  const phases = numbered.filter((m) => m.kind === "phase");
  const points = numbered.filter((m) => m.kind === "milestone" && m.starts_on);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr + "T00:00");
  const daysFromToday = (s) => Math.round((Date.parse(dateOnly(s) + "T00:00") - todayMs) / dayMs);

  // A phase's countdown, phrased relative to today.
  const countdown = (phase) => {
    if (!phase.ends_on) return null;
    const d = daysFromToday(phase.ends_on);
    if (d < 0) return { text: t("progress.daysOver", { n: -d }), tone: "text-danger" };
    if (d === 0) return { text: t("progress.endsToday"), tone: "text-accent" };
    if (d === 1) return { text: t("progress.dayLeft"), tone: "text-accent" };
    return { text: t("progress.daysLeft", { n: d }), tone: "text-accent" };
  };

  // Nest each point milestone under the phase whose date span contains it.
  const pointsForPhase = (phase) =>
    points.filter(
      (pt) =>
        phase.starts_on && phase.ends_on &&
        dateOnly(pt.starts_on) >= dateOnly(phase.starts_on) &&
        dateOnly(pt.starts_on) <= dateOnly(phase.ends_on)
    );

  // Coming up: merge future dated events across the project, sorted soonest-first.
  const upcoming = [];
  for (const p of phases) {
    if ((p.status === "active" || p.status === "upcoming") && p.ends_on && daysFromToday(p.ends_on) >= 0) {
      upcoming.push({ date: dateOnly(p.ends_on), icon: Flag, label: t("progress.upPhaseEnds", { phase: phaseLabel(p.phaseNo, p.title) }) });
    }
  }
  for (const pt of points) {
    if (daysFromToday(pt.starts_on) >= 0) upcoming.push({ date: dateOnly(pt.starts_on), icon: Diamond, label: pt.title });
  }
  if (nextMeeting) upcoming.push({ date: dateOnly(nextMeeting.starts_at), icon: CalendarClock, label: t("progress.upMeeting", { topic: nextMeeting.topic }) });
  for (const inv of dueInvoices || []) {
    if (daysFromToday(inv.due_date) >= 0) upcoming.push({ date: dateOnly(inv.due_date), icon: Receipt, label: t("progress.upInvoiceDue", { number: inv.invoice_number }) });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  const comingUp = upcoming.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Journey */}
      <section className="rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
        <h2 className="flex items-center gap-1.5 text-[19px]">
          {t("progress.journeyTitle")}
          <InfoTip text={t("progress.journeyTip")} />
        </h2>

        {phases.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">{t("progress.noPhases")}</p>
        ) : (
          <ol className="mt-6">
            {phases.map((p, i) => {
              const step = STEP[p.status] || STEP.upcoming;
              const isLast = i === phases.length - 1;
              const cd = (p.status === "active" || p.status === "blocked") ? countdown(p) : null;
              const nested = pointsForPhase(p);
              return (
                <li key={p.id} className="relative flex gap-4 pb-7 last:pb-0">
                  {/* Connector rail */}
                  {!isLast && <span className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px ${step.line}`} />}
                  {/* Node */}
                  <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.dot}`}>
                    {p.status === "done" ? <Check size={15} strokeWidth={2.6} /> : <Dot size={22} />}
                  </span>
                  {/* Body */}
                  <div className={`min-w-0 flex-1 rounded-xl border px-4 py-3 ${p.status === "active" ? "border-accent/40 bg-accent/[0.04]" : p.status === "blocked" ? "border-danger/40 bg-danger/[0.04]" : "border-transparent"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className={`font-medium ${p.status === "upcoming" ? "text-ink-soft" : "text-ink"}`}>
                        {phaseLabel(p.phaseNo, p.title)}
                      </p>
                      <span className={`font-mono text-[10.5px] uppercase tracking-[0.12em] ${step.labelColor}`}>{t(step.label)}</span>
                    </div>
                    {(p.starts_on || p.ends_on) && (
                      <p className="font-mono mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                        <span>{fmt(p.starts_on)}{p.ends_on ? ` – ${fmt(p.ends_on)}` : ""}</span>
                        {cd && <span className={`font-semibold ${cd.tone}`}>· {cd.text}</span>}
                      </p>
                    )}
                    {nested.length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {nested.map((pt) => (
                          <li key={pt.id} className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                            <Diamond size={9} className="shrink-0 text-warn" fill="currentColor" />
                            <span className="min-w-0 truncate">{pt.title}</span>
                            <span className="font-mono shrink-0 text-[10px] text-ink-muted">{fmt(pt.starts_on)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Pulse: what's happened + coming up */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
          <h2 className="flex items-center gap-2 text-[15px]">
            <ActivityIcon size={15} className="text-accent" /> {t("progress.pulseTitle")}
          </h2>
          <ul className="mt-4 space-y-3.5">
            {activity.length === 0 && <li className="text-sm text-ink-muted">{t("progress.noActivity")}</li>}
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="font-mono mt-0.5 w-11 shrink-0 text-[10.5px] text-ink-muted">{fmt(a.created_at)}</span>
                <span className="min-w-0 text-ink-soft">{a.summary}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
          <h2 className="flex items-center gap-2 text-[15px]">
            <CalendarClock size={15} className="text-accent" /> {t("progress.comingUpTitle")}
          </h2>
          <ul className="mt-4 space-y-3">
            {comingUp.length === 0 && <li className="text-sm text-ink-muted">{t("progress.nothingComingUp")}</li>}
            {comingUp.map((u, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <u.icon size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{u.label}</span>
                <span className="font-mono shrink-0 text-[11px] text-ink-muted">{fmtFull(u.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
