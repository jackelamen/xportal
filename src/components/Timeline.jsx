// Horizontal Gantt strip rendered from project_milestones. Phases draw as
// bars, point milestones as diamonds, with a "today" line.

const BAR_COLOR = {
  done: "bg-accent-2/70",
  active: "bg-accent",
  blocked: "bg-danger",
  upcoming: "bg-bg-tertiary border border-line",
};

const dayMs = 86_400_000;
const toT = (s) => new Date(s + "T00:00").getTime();

export default function Timeline({ milestones, today = Date.now() }) {
  const phases = milestones.filter((m) => m.kind === "phase" && m.starts_on && m.ends_on);
  const points = milestones.filter((m) => m.kind === "milestone" && m.starts_on);
  if (phases.length === 0) return null;

  const min = Math.min(...phases.map((p) => toT(p.starts_on)));
  const max = Math.max(...phases.map((p) => toT(p.ends_on)), ...points.map((p) => toT(p.starts_on)));
  const span = Math.max(max - min, dayMs);
  const pct = (t) => ((t - min) / span) * 100;

  const months = [];
  for (let d = new Date(min); d.getTime() <= max; d.setMonth(d.getMonth() + 1, 1)) {
    months.push({ label: d.toLocaleDateString("en-US", { month: "short" }), at: pct(d.getTime()) });
  }

  return (
    <div className="select-none">
      <div className="relative h-4 text-[10px] text-ink-muted">
        {months.map((m, i) => (
          <span key={i} className="absolute" style={{ left: `${Math.max(m.at, 0)}%` }}>{m.label}</span>
        ))}
      </div>
      <div className="relative space-y-1.5 rounded-lg border border-line bg-bg-primary/40 py-3">
        {today >= min && today <= max && (
          <div
            className="absolute inset-y-0 z-10 w-px bg-warn/80"
            style={{ left: `${pct(today)}%` }}
            title="Today"
          />
        )}
        {phases.map((p) => (
          <div key={p.id} className="relative h-6">
            <div
              className={`absolute flex h-full items-center overflow-hidden rounded px-2 text-[11px] font-medium text-white ${BAR_COLOR[p.status] || BAR_COLOR.upcoming}`}
              style={{ left: `${pct(toT(p.starts_on))}%`, width: `${Math.max(pct(toT(p.ends_on)) - pct(toT(p.starts_on)), 3)}%` }}
              title={`${p.title}: ${p.starts_on} → ${p.ends_on} (${p.status})`}
            >
              <span className={`truncate ${p.status === "upcoming" ? "text-ink-soft" : ""}`}>{p.title}</span>
            </div>
          </div>
        ))}
        {points.length > 0 && (
          <div className="relative h-6">
            {points.map((m) => (
              <div
                key={m.id}
                className="absolute top-1 flex flex-col items-center"
                style={{ left: `${pct(toT(m.starts_on))}%` }}
                title={`${m.title} — ${m.starts_on}`}
              >
                <div className="h-2.5 w-2.5 rotate-45 bg-warn" />
                <span className="mt-0.5 max-w-24 truncate text-[10px] text-ink-soft">{m.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
