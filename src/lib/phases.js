// Project phases are project_milestones rows with kind='phase'. They carry no
// stored number - the "Phase N:" prefix is the row's 1-based position among the
// project's phases (in sort_order), so numbers stay contiguous after deletes.

// Annotate each kind='phase' row with phaseNo (1-based among phases). Non-phase
// rows pass through untouched. Use this where a filtered subset (e.g. the
// date-bearing phases on the Timeline) would otherwise lose the true index.
export function numberPhases(milestones) {
  let n = 1;
  return milestones.map((m) =>
    m.kind === "phase" ? { ...m, phaseNo: n++ } : m
  );
}

// Render-time display name. phaseNo == null → plain title (e.g. point milestones).
export function phaseLabel(phaseNo, title) {
  return phaseNo == null ? title : `Phase ${phaseNo}: ${title}`;
}

// Which phase should be shown as the project's "current phase" in Status.
// Plan is the single source of truth: prefer whichever phase is marked
// active, tie-broken by earliest start date (so two phases accidentally left
// active don't just resolve to array order) - undated active phases sort
// last since there's nothing to compare. If nothing is active, fall back to
// the most recently completed phase, then the very first phase. `phases`
// must already be ordered by sort_order.
export function pickCurrentPhase(phases) {
  if (!phases?.length) return null;
  const active = phases.filter((p) => p.status === "active");
  if (active.length) {
    return active.slice().sort((a, b) => {
      if (!a.starts_on && !b.starts_on) return 0;
      if (!a.starts_on) return 1;
      if (!b.starts_on) return -1;
      return a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : 0;
    })[0];
  }
  const done = phases.filter((p) => p.status === "done");
  if (done.length) return done[done.length - 1];
  return phases[0];
}
