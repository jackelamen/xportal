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

// Colored glass: the health tint carries the value and the delta pill.
const TONE = {
  good: { value: "text-accent-2", pill: "bg-accent-2/12 text-accent-2", label: "on target" },
  close: { value: "text-warn", pill: "bg-warn/14 text-warn", label: "close" },
  off: { value: "text-danger", pill: "bg-danger/12 text-danger", label: "off target" },
  none: { value: "text-ink-soft", pill: "", label: "" },
};

const fmt = (v, unit) => (v == null ? "—" : `${Number(v) % 1 === 0 ? v : Number(v).toFixed(1)}${unit || ""}`);

export default function KpiGrid({ kpis }) {
  if (!kpis?.length) return null;
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-line rounded-xl border border-line bg-bg-secondary sm:grid-cols-3 lg:grid-cols-4 lg:divide-y-0">
      {kpis.map((k) => {
        const h = health(k);
        const t = TONE[h];
        const Icon = k.direction === "down" ? TrendingDown : k.current_value == null ? Minus : TrendingUp;
        return (
          <div key={k.id} className="p-4">
            <p className="text-xs font-semibold text-ink">{k.name}</p>
            <p className={`font-data mt-2.5 text-[1.6rem] font-medium leading-none tracking-tight ${t.value}`}>
              {fmt(k.current_value, k.unit)}
            </p>
            {t.label && (
              <span className={`mt-2.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${t.pill}`}>
                <Icon size={11} /> {t.label}
              </span>
            )}
            <p className="font-data mt-2 text-[10.5px] text-ink-muted">
              Goal {fmt(k.target_value, k.unit)}
              {k.direction === "down" ? " · lower wins" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
