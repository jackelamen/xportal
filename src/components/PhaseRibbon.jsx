const PHASES = ["Research", "Optimize", "Unify", "Test", "Execute"];

const normalize = (p) => p;

export default function PhaseRibbon({ currentPhase }) {
  const idx = Math.max(0, PHASES.indexOf(normalize(currentPhase)));
  return (
    <ol className="flex items-center gap-2">
      {PHASES.map((phase, i) => (
        <li key={phase} className="flex flex-1 items-center gap-2">
          <div className="flex-1">
            <div className={`h-1 rounded-full ${i <= idx ? "bg-accent" : "bg-bg-tertiary"}`} />
            <p className={`mt-1.5 text-xs ${i === idx ? "font-semibold text-ink" : "text-ink-muted"}`}>
              {phase}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
