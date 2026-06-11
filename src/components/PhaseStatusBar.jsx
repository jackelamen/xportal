// Rich phase status bar driven by project_milestones (kind='phase').
// Falls back to a simple named ribbon when no milestone data exists.

const STATUS_COLOR = {
  done: "bg-accent-2",
  active: "bg-accent",
  blocked: "bg-danger",
  upcoming: "bg-bg-tertiary",
};

const fmtRange = (a, b) => {
  const f = (s) => s && new Date(s + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return a && b ? `${f(a)} – ${f(b)}` : f(a) || "";
};

const FALLBACK = ["Research", "Optimize", "Unify", "Test", "Execute"];

export default function PhaseStatusBar({ phases, currentPhase, progress }) {
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

  return (
    <div>
      <div className="flex items-end gap-1.5">
        {items.map((ph) => (
          <div key={ph.id} className="group relative flex-1" title={`${ph.title} — ${ph.status}`}>
            <div className={`h-2.5 rounded-full ${STATUS_COLOR[ph.status] || STATUS_COLOR.upcoming} ${ph.status === "active" ? "animate-pulse" : ""}`} />
            <p className={`mt-1.5 truncate text-xs ${ph.status === "active" ? "font-semibold text-ink" : ph.status === "done" ? "text-ink-soft" : "text-ink-muted"}`}>
              {ph.title}
            </p>
            <p className="font-data truncate text-[10px] text-ink-muted">{fmtRange(ph.starts_on, ph.ends_on)}</p>
          </div>
        ))}
      </div>
      {typeof progress === "number" && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <span className="font-data text-xs font-medium text-ink-soft">{progress}%</span>
        </div>
      )}
    </div>
  );
}
