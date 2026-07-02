"use client";

// Horizontal Gantt strip rendered from project_milestones. Phases draw as
// bars, point milestones as diamonds, with a "today" line. Dates are always
// visible (not hover-only) so the chart reads without interaction.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { numberPhases, phaseLabel } from "@/lib/phases";

const BAR_COLOR = {
  done: "bg-accent-2/70",
  active: "bg-accent",
  blocked: "bg-danger",
  upcoming: "bg-bg-tertiary border border-line",
};

const dayMs = 86_400_000;
const toT = (s) => new Date(s + "T00:00").getTime();
const fmtDate = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// The chart never renders narrower than this (it scrolls horizontally
// instead), so percentage-based gaps below can be calibrated against a fixed
// pixel width instead of an unknown, shrinking container — otherwise the same
// percentage means fewer pixels on a narrow card and labels start colliding.
const CHART_MIN_WIDTH = 640;
// Milestone labels are ~80px wide; two labels closer than this (as a % of
// CHART_MIN_WIDTH) would overlap. Greedy lane assignment stacks close-together
// milestones into extra rows instead of letting their labels collide.
const MIN_LABEL_GAP_PCT = 14;

function layoutPoints(points, pct) {
  const sorted = [...points].sort((a, b) => toT(a.starts_on) - toT(b.starts_on));
  const laneEnds = []; // last-claimed pct per lane
  return sorted.map((m) => {
    const p = pct(toT(m.starts_on));
    let lane = laneEnds.findIndex((end) => p - end >= MIN_LABEL_GAP_PCT);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = p;
    return { ...m, pct: p, lane };
  });
}

// Real date ticks along the ruler, not just a month name — weekly for short
// projects (where a single "JUL" label would be nearly useless), monthly once
// that would pack in too many labels to read.
function buildTicks(min, max, pct) {
  const spanDays = (max - min) / dayMs;
  const ticks = [];
  if (spanDays <= 70) {
    for (let t = min; t <= max; t += 7 * dayMs) {
      ticks.push({ label: fmtDate(t), at: pct(t) });
    }
    if (ticks.length === 0 || ticks[ticks.length - 1].at < 99) {
      ticks.push({ label: fmtDate(max), at: pct(max) });
    }
  } else {
    for (let d = new Date(min); d.getTime() <= max; d.setMonth(d.getMonth() + 1, 1)) {
      ticks.push({ label: d.toLocaleDateString("en-US", { month: "short" }), at: pct(d.getTime()) });
    }
  }
  return ticks;
}

const LEGEND = [
  { label: "Done", swatch: "bg-accent-2/70" },
  { label: "Active", swatch: "bg-accent" },
  { label: "Blocked", swatch: "bg-danger" },
  { label: "Upcoming", swatch: "bg-bg-tertiary border border-line" },
];

export default function Timeline({ milestones, today = Date.now() }) {
  const [showMilestones, setShowMilestones] = useState(true);

  const numbered = numberPhases(milestones);
  const phases = numbered.filter((m) => m.kind === "phase" && m.starts_on && m.ends_on);
  const points = numbered.filter((m) => m.kind === "milestone" && m.starts_on);
  if (phases.length === 0) return null;

  const min = Math.min(...phases.map((p) => toT(p.starts_on)));
  const max = Math.max(...phases.map((p) => toT(p.ends_on)), ...points.map((p) => toT(p.starts_on)));
  const span = Math.max(max - min, dayMs);
  const pct = (t) => ((t - min) / span) * 100;

  const ticks = buildTicks(min, max, pct);
  const laidOutPoints = layoutPoints(points, pct);
  const pointLanes = laidOutPoints.reduce((n, p) => Math.max(n, p.lane + 1), 0);
  const POINT_ROW_PX = 40;

  return (
    <div className="select-none">
      {/* Legend + milestone toggle — explains the visual language up front. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-muted">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${l.swatch}`} /> {l.label}
            </span>
          ))}
          {points.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rotate-45 bg-warn" /> Milestone
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-px bg-danger" /> Today
          </span>
        </div>
        {points.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMilestones((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:border-accent hover:text-ink"
          >
            {showMilestones ? <EyeOff size={12} /> : <Eye size={12} />}
            {showMilestones ? "Hide" : "Show"} milestones
          </button>
        )}
      </div>

      {/* Scrolls horizontally below CHART_MIN_WIDTH instead of crushing labels
          into each other — keeps the lane-packing math below valid at any
          viewport, since the chart is never narrower than CHART_MIN_WIDTH. */}
      <div className="overflow-x-auto">
      <div style={{ minWidth: CHART_MIN_WIDTH }}>

      {/* Date ruler — always-visible tick labels, not just a lone month name. */}
      <div className="font-data relative h-4 text-[10px] text-ink-muted">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${Math.min(Math.max(t.at, 0), 100)}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>

      <div className="relative space-y-2 rounded-lg border border-line bg-bg-primary/40 p-3">
        {today >= min && today <= max && (
          <div
            className="absolute inset-y-0 z-10 w-px bg-danger/70"
            style={{ left: `${pct(today)}%` }}
          >
            <span className="font-data absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-danger">
              Today
            </span>
          </div>
        )}

        {phases.map((p) => (
          <div key={p.id} className="relative">
            <div className="relative h-6">
              <div
                className={`absolute flex h-full items-center overflow-hidden rounded px-2 text-[11px] font-medium text-white ${BAR_COLOR[p.status] || BAR_COLOR.upcoming}`}
                style={{ left: `${pct(toT(p.starts_on))}%`, width: `${Math.max(pct(toT(p.ends_on)) - pct(toT(p.starts_on)), 3)}%` }}
              >
                <span className={`truncate ${p.status === "upcoming" ? "text-ink-soft" : ""}`}>{phaseLabel(p.phaseNo, p.title)}</span>
              </div>
            </div>
            <p
              className="font-data absolute top-6 whitespace-nowrap text-[10px] text-ink-muted"
              style={{ left: `${pct(toT(p.starts_on))}%` }}
            >
              {fmtDate(toT(p.starts_on))} – {fmtDate(toT(p.ends_on))}
            </p>
          </div>
        ))}
        {/* Spacer so the date labels under the last phase row have room. */}
        <div className="h-3" />

        {showMilestones && laidOutPoints.length > 0 && (
          <div className="relative" style={{ height: pointLanes * POINT_ROW_PX }}>
            {laidOutPoints.map((m) => (
              <div
                key={m.id}
                className="absolute flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${m.pct}%`, top: m.lane * POINT_ROW_PX }}
                title={m.title}
              >
                <div className="h-2.5 w-2.5 shrink-0 rotate-45 bg-warn" />
                <span className="mt-1 max-w-20 truncate text-[10px] font-medium text-ink-soft">{m.title}</span>
                <span className="font-data text-[9px] text-ink-muted">{fmtDate(toT(m.starts_on))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>
      </div>
    </div>
  );
}
