import { Check, TriangleAlert, Minus } from "lucide-react";
import { InfoTip } from "@/components/Tip";

// A KPI's health + a plain-English status line describing where it sits
// relative to its goal. Countable metrics (whole numbers, no unit) read as
// "N over/under goal"; scores and percentages read as "Beating target".
function evaluate(k) {
  const c = k.current_value;
  const t = k.target_value;
  if (c == null || t == null) return { tone: "none", text: "No target set" };

  const good = k.direction === "down" ? c <= t : c >= t;
  const delta = c - t;
  const isCount = !k.unit && Number.isInteger(c) && Number.isInteger(t) && Math.abs(delta) >= 1;
  const overUnder = delta > 0 ? "over" : "under";

  let tone;
  if (good) tone = "good";
  else if (isCount) tone = Math.abs(delta) <= 1 ? "close" : "off";
  else {
    const ratio = k.direction === "down" ? t / c : c / t;
    tone = ratio >= 0.85 ? "close" : "off";
  }

  let text;
  if (delta === 0) text = "On target";
  else if (isCount) text = `${Math.abs(delta)} ${overUnder} goal`;
  else if (good) text = "Beating target";
  else text = k.direction === "down" ? "Over target" : "Below target";

  return { tone, text };
}

const TONE = {
  good: { chip: "bg-accent-2/12 text-accent-2", Icon: Check },
  close: { chip: "bg-warn/14 text-warn", Icon: TriangleAlert },
  off: { chip: "bg-danger/12 text-danger", Icon: TriangleAlert },
  none: { chip: "bg-bg-tertiary text-ink-muted", Icon: Minus },
};

const fmt = (v) => (v == null ? "—" : Number(v) % 1 === 0 ? String(v) : Number(v).toFixed(1));

export default function KpiGrid({ kpis }) {
  if (!kpis?.length) return null;

  const evaluated = kpis.map((k) => ({ k, ...evaluate(k) }));
  const scored = evaluated.filter((e) => e.tone !== "none");
  const onTarget = scored.filter((e) => e.tone === "good").length;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
          Key results
          <InfoTip text="The numbers this project is judged by. Green is beating or meeting the goal, amber is close, red is off target." />
        </p>
        {scored.length > 0 && (
          <span className="font-mono flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className={`h-1.5 w-1.5 rounded-full ${onTarget === scored.length ? "bg-accent-2" : "bg-warn"}`} />
            {onTarget} of {scored.length} on target
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
                <span className="font-serif text-[2.1rem]">{fmt(k.current_value)}</span>
                {k.unit && <span className="text-[13px] font-medium text-ink-muted">{k.unit}</span>}
              </p>

              <span className={`font-mono mt-3 inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${chip}`}>
                <Icon size={11} strokeWidth={2.4} />
                {text}
              </span>

              <p className="font-mono mt-2.5 text-[10px] text-ink-muted">
                {k.target_value == null ? "No goal" : `Goal ${fmt(k.target_value)}${k.unit || ""}`}
                {k.direction === "down" && k.target_value != null ? " · lower wins" : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
