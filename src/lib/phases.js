// Project phases are project_milestones rows with kind='phase'. They carry no
// stored number — the "Phase N:" prefix is the row's 0-based position among the
// project's phases (in sort_order), so numbers stay contiguous after deletes.

// Annotate each kind='phase' row with phaseNo (0-based among phases). Non-phase
// rows pass through untouched. Use this where a filtered subset (e.g. the
// date-bearing phases on the Timeline) would otherwise lose the true index.
export function numberPhases(milestones) {
  let n = 0;
  return milestones.map((m) =>
    m.kind === "phase" ? { ...m, phaseNo: n++ } : m
  );
}

// Render-time display name. phaseNo == null → plain title (e.g. point milestones).
export function phaseLabel(phaseNo, title) {
  return phaseNo == null ? title : `Phase ${phaseNo}: ${title}`;
}
