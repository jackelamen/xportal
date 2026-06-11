import { Info } from "lucide-react";

// Dependency-free tooltips, server-component friendly (pure CSS hover/focus).
//
//   <Tip text="What this does"><button>…</button></Tip>   — wraps any element
//   <InfoTip text="What this section means" />             — small ⓘ next to headings/labels

export function Tip({ text, children, side = "top" }) {
  const pos =
    side === "bottom"
      ? "top-full mt-1.5 left-1/2 -translate-x-1/2"
      : "bottom-full mb-1.5 left-1/2 -translate-x-1/2";
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden w-max max-w-64 whitespace-normal rounded-lg border border-line bg-bg-tertiary px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-ink shadow-none group-hover/tip:block group-focus-within/tip:block ${pos}`}
      >
        {text}
      </span>
    </span>
  );
}

export function InfoTip({ text, side }) {
  return (
    <Tip text={text} side={side}>
      <span tabIndex={0} className="cursor-help text-ink-muted outline-none hover:text-ink focus-visible:text-ink">
        <Info size={13} aria-label="More info" />
      </span>
    </Tip>
  );
}
