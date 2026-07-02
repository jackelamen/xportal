import { Flag } from "lucide-react";
import { phaseLabel } from "@/lib/phases";

// The phase-timeline card body: a connected track of phase segments with the
// active one highlighted, a slim progress bar, target date, and what's next.
// The page provides the surrounding "Phase timeline" card + eyebrow; the big
// project title lives in the page hero above, so this doesn't repeat a heading.

const fmtDate = (s) =>
  s ? new Date(s + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

const barColor = (s) =>
  s === "done" ? "bg-accent-2/70"
  : s === "active" ? "bg-accent"
  : s === "blocked" ? "bg-danger"
  : "bg-bg-tertiary border border-line";

export default function ProjectStatus({ phases, currentPhase, progress, targetDate }) {
  const items = phases?.length > 0 ? phases : [];
  const activeIdx = items.findIndex((p) => p.status === "active");
  const blocked = items.find((p) => p.status === "blocked");
  const blockedIdx = blocked ? items.indexOf(blocked) : -1;
  const next = items.slice(activeIdx + 1).find((p) => p.status === "upcoming");
  const nextIdx = next ? items.indexOf(next) : -1;

  return (
    <div>
      {items.length > 0 ? (
        <div className="flex gap-1.5">
          {items.map((ph, i) => (
            <div key={ph.id} className="min-w-0 flex-1">
              <div
                className={`h-2.5 rounded-full ${barColor(ph.status)} ${
                  ph.status === "active" ? "shadow-[0_2px_10px_-2px_rgb(91_72_238_/_0.55)]" : ""
                }`}
              />
              <p
                className={`mt-2.5 truncate text-[11px] ${
                  ph.status === "active" ? "font-semibold text-accent"
                  : ph.status === "blocked" ? "font-semibold text-danger"
                  : ph.status === "done" ? "text-ink-soft" : "text-ink-muted"
                }`}
              >
                {phaseLabel(i, ph.title)}
              </p>
              {ph.starts_on && (
                <p className="font-mono truncate text-[10px] text-ink-muted">
                  {fmtDate(ph.starts_on)}{ph.ends_on ? ` – ${fmtDate(ph.ends_on)}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : currentPhase ? (
        <p className="font-serif text-lg text-ink">{currentPhase}</p>
      ) : (
        <p className="text-sm text-ink-muted">No phases defined yet.</p>
      )}

      {(typeof progress === "number" || targetDate || next || blocked) && (
        <div className="mt-5 border-t border-line pt-4">
          {typeof progress === "number" && (
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                <div className="h-full rounded-full bg-accent-2" style={{ width: `${progress}%` }} />
              </div>
              <span className="font-mono text-[12px] font-medium text-ink-soft">{progress}%</span>
              {targetDate && (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
                  <Flag size={12} className="text-accent" /> target {targetDate}
                </span>
              )}
            </div>
          )}
          {(next || blocked) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
              {blocked && (
                <span className="font-medium text-danger">
                  {phaseLabel(blockedIdx, blocked.title)} is blocked — needs attention
                </span>
              )}
              {next && (
                <span>
                  Up next: <span className="font-medium text-ink">{phaseLabel(nextIdx, next.title)}</span>
                  {next.starts_on && <span className="font-mono text-xs text-ink-muted"> · starts {fmtDate(next.starts_on)}</span>}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
