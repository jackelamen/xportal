"use client";

// A readable Gantt: every phase is its own labeled row (name + date range in a
// fixed left column) with a date-positioned bar in the track column. A single
// Today line runs the full height of the track; a shared date ruler sits on
// top. Point milestones follow as their own labeled rows with dated diamonds.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { numberPhases, phaseLabel } from "@/lib/phases";
import { t as translate } from "@/lib/i18n";

const dayMs = 86_400_000;
const DATE_LOCALE = { en: "en-US", ko: "ko-KR" };
const toT = (s) => new Date(s + "T00:00").getTime();

// Fixed widths keep the track column's coordinate space identical to the
// Today-line overlay and the ruler, so nothing drifts out of alignment.
const LABEL_W = 176; // px - phase name + date range column
const CHART_MIN_W = 560; // px - track never crushes below this; scrolls instead

const BAR = {
  done: "bg-accent-2/70",
  active: "bg-accent",
  blocked: "bg-danger",
  upcoming: "border border-line bg-bg-tertiary",
};
const DOT = {
  done: "bg-accent-2",
  active: "bg-accent",
  blocked: "bg-danger",
  upcoming: "bg-ink-muted/40",
};

// Diagonal hatch marks the in-progress phase, tinted with the (possibly
// client-branded) accent variable so it recolors with per-client branding.
const activeStripes = {
  backgroundImage:
    "repeating-linear-gradient(45deg, transparent, transparent 6px, rgb(255 255 255 / 0.28) 6px, rgb(255 255 255 / 0.28) 12px)",
};

// Weekly ticks for short projects (a lone month name would be useless there),
// monthly once weekly would pack in too many labels to read.
function buildTicks(min, max, pct, dl) {
  const spanDays = (max - min) / dayMs;
  const ticks = [];
  const day = ( t) => new Date(t).toLocaleDateString(dl, { month: "short", day: "numeric" });
  if (spanDays <= 70) {
    for (let t = min; t <= max; t += 7 * dayMs) ticks.push({ label: day(t), at: pct(t) });
    if (ticks.length === 0 || ticks[ticks.length - 1].at < 99) ticks.push({ label: day(max), at: pct(max) });
  } else {
    for (let d = new Date(min); d.getTime() <= max; d.setMonth(d.getMonth() + 1, 1)) {
      ticks.push({ label: d.toLocaleDateString(dl, { month: "short" }), at: pct(d.getTime()) });
    }
  }
  return ticks;
}

export default function Timeline({ milestones, today = Date.now(), locale = "en" }) {
  const [showMilestones, setShowMilestones] = useState(true);
  const t = (key, vars) => translate(locale, key, vars);
  const dl = DATE_LOCALE[locale] || "en-US";
  const fmtDate = (time) => new Date(time).toLocaleDateString(dl, { month: "short", day: "numeric" });
  const LEGEND = [
    { label: t("timeline.legendDone"), swatch: "bg-accent-2/70" },
    { label: t("timeline.legendInProgress"), swatch: "bg-accent" },
    { label: t("timeline.legendBlocked"), swatch: "bg-danger" },
    { label: t("timeline.legendUpcoming"), swatch: "border border-line bg-bg-tertiary" },
  ];

  const numbered = numberPhases(milestones);
  const phases = numbered.filter((m) => m.kind === "phase" && m.starts_on && m.ends_on);
  const points = numbered
    .filter((m) => m.kind === "milestone" && m.starts_on)
    .sort((a, b) => toT(a.starts_on) - toT(b.starts_on));
  if (phases.length === 0) return null;

  const min = Math.min(...phases.map((p) => toT(p.starts_on)));
  const max = Math.max(...phases.map((p) => toT(p.ends_on)), ...points.map((p) => toT(p.starts_on)));
  const span = Math.max(max - min, dayMs);
  const pct = (t) => ((t - min) / span) * 100;
  const clamp = (n) => Math.min(Math.max(n, 0), 100);

  const ticks = buildTicks(min, max, pct, dl);
  const todayOnChart = today >= min && today <= max;

  return (
    <div className="select-none">
      {/* Legend + milestone toggle - explains the visual language up front. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-muted">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${l.swatch}`} /> {l.label}
            </span>
          ))}
          {points.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rotate-45 bg-warn" /> {t("timeline.legendMilestone")}
            </span>
          )}
          {todayOnChart && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-px bg-danger" /> {t("timeline.legendToday")}
            </span>
          )}
        </div>
        {points.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMilestones((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:border-accent hover:text-ink"
          >
            {showMilestones ? <EyeOff size={12} /> : <Eye size={12} />}
            {t(showMilestones ? "timeline.hideMilestones" : "timeline.showMilestones")}
          </button>
        )}
      </div>

      {/* Scrolls horizontally instead of crushing the track below CHART_MIN_W. */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_W + CHART_MIN_W }}>
          {/* Date ruler, aligned to the track column. */}
          <div className="flex items-end">
            <div className="shrink-0" style={{ width: LABEL_W }} />
            <div className="font-mono relative h-4 flex-1 text-[10px] text-ink-muted">
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                  style={{ left: `${clamp(t.at)}%` }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Rows + a single continuous Today line over the track area. */}
          <div className="relative mt-1.5 rounded-xl border border-line bg-bg-primary/40 py-2">
            {/* Today line: constrained to the track column so it lines up with bars. */}
            {todayOnChart && (
              <div className="pointer-events-none absolute inset-y-0" style={{ left: LABEL_W, right: 0 }}>
                <div className="absolute inset-y-1 w-px bg-danger/70" style={{ left: `${pct(today)}%` }} />
              </div>
            )}

            {phases.map((p) => {
              const left = clamp(pct(toT(p.starts_on)));
              const width = Math.max(clamp(pct(toT(p.ends_on))) - left, 1.5);
              return (
                <div key={p.id} className="flex items-center py-1.5">
                  <div className="shrink-0 pl-3 pr-3" style={{ width: LABEL_W }}>
                    <p className="flex items-center gap-2 truncate text-[12.5px] font-medium text-ink">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[p.status] || DOT.upcoming}`} />
                      {phaseLabel(p.phaseNo, p.title)}
                    </p>
                    <p className="font-mono mt-0.5 pl-3.5 text-[10px] text-ink-muted">
                      {fmtDate(toT(p.starts_on))} – {fmtDate(toT(p.ends_on))}
                    </p>
                  </div>
                  <div className="relative h-7 flex-1">
                    <div
                      className={`absolute top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-md ${BAR[p.status] || BAR.upcoming}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${phaseLabel(p.phaseNo, p.title)} · ${p.status}`}
                    >
                      {p.status === "active" && <div className="absolute inset-0" style={activeStripes} />}
                    </div>
                  </div>
                </div>
              );
            })}

            {showMilestones && points.length > 0 && (
              <>
                <div className="my-1.5 flex items-center gap-2 pl-3">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">{t("timeline.milestonesLabel")}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                {points.map((m) => {
                  const at = clamp(pct(toT(m.starts_on)));
                  const flip = at > 82; // keep the date label on-canvas near the right edge
                  return (
                    <div key={m.id} className="flex items-center py-1">
                      <div className="shrink-0 truncate pl-3 pr-3 text-[12px] text-ink-soft" style={{ width: LABEL_W }}>
                        {m.title}
                      </div>
                      <div className="relative h-5 flex-1">
                        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${at}%` }}>
                          <div className="flex items-center gap-1.5" style={flip ? { transform: "translateX(-100%)", flexDirection: "row-reverse" } : undefined}>
                            <span className="h-2.5 w-2.5 shrink-0 rotate-45 bg-warn" />
                            <span className="font-mono whitespace-nowrap text-[9.5px] text-ink-muted">
                              {fmtDate(toT(m.starts_on))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
