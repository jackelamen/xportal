// Shared KPI health evaluation, used by the client-facing KpiGrid and the
// admin editor so both sides always agree on what green/amber/red means.
//
// tone: "good"  - goal met/beaten, or a boolean KPI reading "Yes"
//       "close" - within 15% of a numeric goal (no boolean equivalent)
//       "off"   - more than 15% away, or a boolean KPI reading "No"
//       "none"  - no goal/reading yet, or a boolean KPI still "Pending"
// progress: 0..1 fraction of the way to the goal (1 when met), null when
//           it can't be computed (always null for boolean KPIs - they render
//           as a status chip, not a meter).
export function kpiHealth(kpi) {
  if (kpi.kind === "boolean") {
    if (kpi.current_value == null) return { tone: "none", progress: null };
    return { tone: Number(kpi.current_value) ? "good" : "off", progress: null };
  }

  const current = kpi.current_value == null ? null : Number(kpi.current_value);
  const target = kpi.target_value == null ? null : Number(kpi.target_value);
  if (current == null || target == null) return { tone: "none", progress: null };

  const down = kpi.direction === "down";
  const met = down ? current <= target : current >= target;
  if (met) return { tone: "good", progress: 1 };

  // How close we are, as a fraction of the goal (guarding zero divides).
  const ratio = down
    ? (current > 0 ? target / current : 0)
    : (target > 0 ? current / target : 0);
  const progress = Math.max(0, Math.min(1, ratio));
  return { tone: progress >= 0.85 ? "close" : "off", progress };
}

export const formatKpiValue = (v) =>
  v == null ? "–" : Number(v) % 1 === 0 ? String(Number(v)) : Number(v).toFixed(1);
