import { Diamond } from "lucide-react";
import { numberPhases, phaseLabel } from "@/lib/phases";
import { InfoTip } from "@/components/Tip";
import { t as translate, formatDate } from "@/lib/i18n";

// "The plan": the admin-authored outline of phases and milestones with a short
// "what to expect" note on each. It reads as a brief (what's coming and why),
// complementing the Progress tab (which shows live status and the pulse). Both
// are driven by the same project_milestones rows.
const STATUS_DOT = {
  done: "bg-accent-2",
  active: "bg-accent",
  blocked: "bg-danger",
  upcoming: "bg-ink-muted/40",
};

export default function ProjectPlan({ milestones, locale = "en" }) {
  const t = (key, vars) => translate(locale, key, vars);
  const fmt = (s) => (s ? formatDate(locale, s, { month: "short", day: "numeric" }) : null);

  const numbered = numberPhases(milestones);
  const phases = numbered.filter((m) => m.kind === "phase");
  const points = numbered.filter((m) => m.kind === "milestone");

  const dateRange = (m) =>
    m.starts_on || m.ends_on
      ? `${fmt(m.starts_on) || "?"}${m.ends_on ? ` – ${fmt(m.ends_on)}` : ""}`
      : t("plan.tbd");

  return (
    <section className="rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
      <h2 className="flex items-center gap-1.5 text-[19px]">
        {t("plan.title")}
        <InfoTip text={t("plan.tip")} />
      </h2>

      {phases.length === 0 && points.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("plan.empty")}</p>
      ) : (
        <ol className="mt-5 space-y-5">
          {phases.map((m) => (
            <li key={m.id} className="border-l-2 border-line pl-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[m.status] || STATUS_DOT.upcoming}`} />
                  {phaseLabel(m.phaseNo, m.title)}
                </span>
                <span className="font-mono text-[11px] text-ink-muted">{dateRange(m)}</span>
              </div>
              {m.detail && <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-soft">{m.detail}</p>}
            </li>
          ))}

          {points.map((m) => (
            <li key={m.id} className="border-l-2 border-warn/40 pl-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <Diamond size={11} className="text-warn" fill="currentColor" />
                  {m.title}
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-muted">{t("plan.milestone")}</span>
                </span>
                <span className="font-mono text-[11px] text-ink-muted">{fmt(m.starts_on) || t("plan.tbd")}</span>
              </div>
              {m.detail && <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-soft">{m.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
