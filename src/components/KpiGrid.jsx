import { Check, TriangleAlert, Minus } from "lucide-react";
import { InfoTip } from "@/components/Tip";
import { t as translate } from "@/lib/i18n";

// A KPI's health + a plain-English status line describing where it sits
// relative to its goal. Countable metrics (whole numbers, no unit) read as
// "N over/under goal"; scores and percentages read as "Beating target".
function evaluate(k, t) {
  const c = k.current_value;
  const tgt = k.target_value;
  if (c == null || tgt == null) return { tone: "none", text: t("kpi.noTargetSet") };

  const good = k.direction === "down" ? c <= tgt : c >= tgt;
  const delta = c - tgt;
  const isCount = !k.unit && Number.isInteger(c) && Number.isInteger(tgt) && Math.abs(delta) >= 1;

  let tone;
  if (good) tone = "good";
  else if (isCount) tone = Math.abs(delta) <= 1 ? "close" : "off";
  else {
    const ratio = k.direction === "down" ? tgt / c : c / tgt;
    tone = ratio >= 0.85 ? "close" : "off";
  }

  let text;
  if (delta === 0) text = t("kpi.onTarget");
  else if (isCount) text = delta > 0 ? t("kpi.overGoal", { n: Math.abs(delta) }) : t("kpi.underGoal", { n: Math.abs(delta) });
  else if (good) text = t("kpi.beatingTarget");
  else text = k.direction === "down" ? t("kpi.overTarget") : t("kpi.belowTarget");

  return { tone, text };
}

const TONE = {
  good: { chip: "bg-accent-2/12 text-accent-2", Icon: Check },
  close: { chip: "bg-warn/14 text-warn", Icon: TriangleAlert },
  off: { chip: "bg-danger/12 text-danger", Icon: TriangleAlert },
  none: { chip: "bg-bg-tertiary text-ink-muted", Icon: Minus },
};

const fmt = (v) => (v == null ? "–" : Number(v) % 1 === 0 ? String(v) : Number(v).toFixed(1));

export default function KpiGrid({ kpis, locale = "en" }) {
  if (!kpis?.length) return null;
  const t = (key, vars) => translate(locale, key, vars);

  const evaluated = kpis.map((k) => ({ k, ...evaluate(k, t) }));
  const scored = evaluated.filter((e) => e.tone !== "none");
  const onTarget = scored.filter((e) => e.tone === "good").length;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {evaluated.map(({ k, tone, text }) => {
          const { chip, Icon } = TONE[tone];
          return (
            <div
              key={k.id}
              className="flex flex-col rounded-xl border border-line bg-bg-secondary p-4 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)] transition-transform hover:-translate-y-0.5"
            >
              <p className="min-h-[2.4em] text-[12.5px] font-semibold leading-snug text-ink">{k.name}</p>

              <p className="mt-2 flex items-baseline gap-0.5 leading-none text-ink">
                <span className="font-sans text-[2.1rem] font-semibold tracking-tight">{fmt(k.current_value)}</span>
                {k.unit && <span className="text-[13px] font-medium text-ink-muted">{k.unit}</span>}
              </p>

              <span className={`font-mono mt-3 inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${chip}`}>
                <Icon size={11} strokeWidth={2.4} />
                {text}
              </span>

              <p className="font-mono mt-2.5 text-[10px] text-ink-muted">
                {k.target_value == null ? t("kpi.noGoal") : t("kpi.goal", { value: `${fmt(k.target_value)}${k.unit || ""}` })}
                {k.direction === "down" && k.target_value != null ? t("kpi.lowerWins") : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
