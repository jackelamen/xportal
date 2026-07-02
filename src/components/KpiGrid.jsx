import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// KPI cards: green when meeting target, amber when within 15%, red otherwise.
function health(kpi) {
  if (kpi.current_value == null || kpi.target_value == null) return "none";
  const ok = kpi.direction === "down"
    ? kpi.current_value <= kpi.target_value
    : kpi.current_value >= kpi.target_value;
  if (ok) return "good";
  const ratio = kpi.direction === "down"
    ? kpi.target_value / kpi.current_value
    : kpi.current_value / kpi.target_value;
  return ratio >= 0.85 ? "close" : "off";
}

// The health tint carries the icon tile, the status chip, and the value.
const TONE = {
  good: { icon: "text-accent-2", chip: "bg-accent-2/12 text-accent-2", label: "On target" },
  close: { icon: "text-warn", chip: "bg-warn/14 text-warn", label: "Close" },
  off: { icon: "text-danger", chip: "bg-danger/12 text-danger", label: "Off target" },
  none: { icon: "text-ink-muted", chip: "bg-bg-tertiary text-ink-muted", label: "—" },
};

const fmt = (v, unit) => (v == null ? "—" : `${Number(v) % 1 === 0 ? v : Number(v).toFixed(1)}${unit || ""}`);

export default function KpiGrid({ kpis }) {
  if (!kpis?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {kpis.map((k) => {
        const t = TONE[health(k)];
        const Icon = k.direction === "down" ? TrendingDown : k.current_value == null ? Minus : TrendingUp;
        return (
          <div key={k.id} className="rounded-xl border border-line bg-bg-secondary p-4 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
            <div className="flex items-center justify-between">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-bg-tertiary ${t.icon}`}>
                <Icon size={15} strokeWidth={2} />
              </span>
              <span className={`font-mono rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${t.chip}`}>
                {t.label}
              </span>
            </div>
            <p className="font-serif mt-4 text-[2rem] leading-none text-ink">
              {fmt(k.current_value, k.unit)}
            </p>
            <p className="font-mono mt-2.5 text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{k.name}</p>
            <p className="font-mono mt-1 text-[10px] text-ink-muted">
              Goal {fmt(k.target_value, k.unit)}{k.direction === "down" ? " · lower wins" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
