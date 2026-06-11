import { Check, Flag } from "lucide-react";

// The first thing a client checks. Answers three questions without thought:
// where are we now, how far along is the whole project, and what's next.

const fmtDate = (s) =>
  s ? new Date(s + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

const FALLBACK = ["Discovery", "Design", "Development", "QA", "Launch"];

export default function ProjectStatus({ phases, currentPhase, progress, targetDate }) {
  const items =
    phases?.length > 0
      ? phases
      : FALLBACK.map((title, i) => ({
          id: title,
          title,
          status:
            i < FALLBACK.indexOf(currentPhase) ? "done" : title === currentPhase ? "active" : "upcoming",
          starts_on: null,
          ends_on: null,
        }));

  const activeIdx = items.findIndex((p) => p.status === "active");
  const active = activeIdx >= 0 ? items[activeIdx] : null;
  const blocked = items.find((p) => p.status === "blocked");
  const next = items.slice(activeIdx + 1).find((p) => p.status === "upcoming");

  return (
    <div>
      {/* The headline answer: where are we, how far along. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Current phase{active && ` · ${activeIdx + 1} of ${items.length}`}
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">
            {blocked ? blocked.title : active ? active.title : currentPhase}
            {blocked && <span className="ml-3 align-middle rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">blocked — needs attention</span>}
          </p>
          {active?.starts_on && active?.ends_on && (
            <p className="font-data mt-1 text-xs text-ink-soft">
              {fmtDate(active.starts_on)} – {fmtDate(active.ends_on)}
            </p>
          )}
        </div>
        {typeof progress === "number" && (
          <div className="text-right">
            <p className="font-data text-4xl font-semibold tracking-tight text-accent">{progress}%</p>
            <p className="text-xs text-ink-muted">of the project complete</p>
          </div>
        )}
      </div>

      {/* The track: one connected bar, each segment a phase. */}
      <div className="mt-6 flex gap-1">
        {items.map((ph) => (
          <div key={ph.id} className="min-w-0 flex-1">
            <div
              className={`h-2 first:rounded-l-full last:rounded-r-full ${
                ph.status === "done" ? "bg-accent-2" :
                ph.status === "active" ? "bg-accent" :
                ph.status === "blocked" ? "bg-danger" : "bg-bg-tertiary"
              } ${ph.status === "active" ? "animate-pulse" : ""} rounded-sm`}
            />
            <div className="mt-2 flex items-start gap-1 pr-2">
              {ph.status === "done" && <Check size={12} className="mt-0.5 shrink-0 text-accent-2" />}
              <div className="min-w-0">
                <p className={`truncate text-xs ${
                  ph.status === "active" ? "font-semibold text-ink" :
                  ph.status === "blocked" ? "font-semibold text-danger" :
                  ph.status === "done" ? "text-ink-soft" : "text-ink-muted"
                }`}>
                  {ph.title}
                </p>
                {ph.starts_on && (
                  <p className="font-data truncate text-[10px] text-ink-muted">
                    {fmtDate(ph.starts_on)}{ph.ends_on ? ` – ${fmtDate(ph.ends_on)}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* What's next — the question clients would otherwise email about. */}
      {(next || targetDate) && (
        <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-4 text-sm text-ink-soft">
          {next && (
            <span>
              Up next: <span className="font-medium text-ink">{next.title}</span>
              {next.starts_on && <span className="font-data text-xs text-ink-muted"> · starts {fmtDate(next.starts_on)}</span>}
            </span>
          )}
          {targetDate && (
            <span className="flex items-center gap-1.5">
              <Flag size={13} className="text-accent" />
              Target delivery <span className="font-data font-medium text-ink">{targetDate}</span>
            </span>
          )}
        </p>
      )}
    </div>
  );
}
