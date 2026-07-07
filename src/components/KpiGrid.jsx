import { InfoTip } from "@/components/Tip";
import { t as translate } from "@/lib/i18n";
import { kpiHealth, formatKpiValue as fmt } from "@/lib/kpi";

// Key results, presented the way the rest of the overview reads: one card,
// one row per metric - name and goal on the left, the number on the right,
// and a slim meter showing how far along the goal is. No stat-tile grid.

const TONE = {
  good: { text: "text-accent-2", bar: "bg-accent-2", key: "kpi.statusOn" },
  close: { text: "text-warn", bar: "bg-warn", key: "kpi.statusClose" },
  off: { text: "text-danger", bar: "bg-danger", key: "kpi.statusOff" },
};

export default function KpiGrid({ kpis, locale = "en" }) {
  if (!kpis?.length) return null;
  const t = (key, vars) => translate(locale, key, vars);

  const rows = kpis.map((k) => ({ k, ...kpiHealth(k) }));
  const scored = rows.filter((r) => r.tone !== "none");
  const onTarget = scored.filter((r) => r.tone === "good").length;

  return (
    <section className="rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
      <div className="flex items-center justify-between">
        <p className="font-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
          {t("kpi.keyResults")}
          <InfoTip text={t("kpi.keyResultsTip")} />
        </p>
        {scored.length > 0 && (
          <span className="font-mono flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className={`h-1.5 w-1.5 rounded-full ${onTarget === scored.length ? "bg-accent-2" : "bg-warn"}`} />
            {t("kpi.onTargetCount", { n: onTarget, m: scored.length })}
          </span>
        )}
      </div>

      <div className="mt-2 divide-y divide-line/70">
        {rows.map(({ k, tone, progress }) => {
          const style = TONE[tone];
          return (
            <div key={k.id} className="py-4 first:pt-3 last:pb-0">
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 truncate text-[13.5px] font-medium text-ink">{k.name}</p>
                <p className="flex shrink-0 items-baseline gap-0.5 leading-none text-ink">
                  <span className="font-data text-[1.35rem] font-semibold tracking-tight">{fmt(k.current_value)}</span>
                  {k.unit && <span className="text-[12px] font-medium text-ink-muted">{k.unit}</span>}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-3">
                {progress != null && (
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className={`h-full rounded-full ${style.bar}`}
                      style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
                    />
                  </div>
                )}
                <p className={`font-mono shrink-0 text-[10.5px] ${progress == null ? "text-ink-muted" : ""}`}>
                  {k.target_value == null ? (
                    <span className="text-ink-muted">{t("kpi.noGoal")}</span>
                  ) : (
                    <>
                      <span className="text-ink-muted">
                        {t("kpi.goal", { value: `${fmt(k.target_value)}${k.unit || ""}` })}
                        {k.direction === "down" ? t("kpi.lowerBetter") : ""}
                        {" · "}
                      </span>
                      {style && <span className={`font-semibold ${style.text}`}>{t(style.key)}</span>}
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
