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

// Colored glass: the health tint carries the whole card — fill, border, and
// value — so status reads from across the room.
const TONE = {
  good: { card: "border-accent-2/30 bg-accent-2/10", value: "text-accent-2", label: "on target" },
  close: { card: "border-warn/30 bg-warn/10", value: "text-warn", label: "close" },
  off: { card: "border-danger/30 bg-danger/10", value: "text-danger", label: "off target" },
  none: { card: "border-line bg-bg-tertiary", value: "text-ink-soft", label: "" },
};

const fmt = (v, unit) => (v == null ? "—" : `${Number(v) % 1 === 0 ? v : Number(v).toFixed(1)}${unit || ""}`);

export default function KpiGrid({ kpis }) {
  if (!kpis?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {kpis.map((k) => {
        const h = health(k);
        const t = TONE[h];
        const Icon = k.direction === "down" ? TrendingDown : k.current_value == null ? Minus : TrendingUp;
        return (
          <div key={k.id} className={`rounded-xl border p-4 ${t.card}`}>
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Icon size={12} className={t.value} /> {k.name}
            </p>
            <p className={`font-data mt-1.5 text-2xl font-semibold ${t.value}`}>
              {fmt(k.current_value, k.unit)}
            </p>
            <p className="font-data mt-0.5 text-xs text-ink-muted">
              target {fmt(k.target_value, k.unit)}
              {k.direction === "down" ? " · lower wins" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
