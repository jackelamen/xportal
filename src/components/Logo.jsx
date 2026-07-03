// The xPortal mark: a bold X whose crossing opens into a lit portal-eye - the
// "x" of xPortal fused with the portal idea, and distinct from a plain flat X.
// `tile` sets the background: indigo = client portal, emerald = operator console.
const TILES = { indigo: "#5b48ee", emerald: "#059669" };

export function LogoMark({ size = 28, tile = "indigo", className = "" }) {
  const fill = TILES[tile] || tile;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden>
      <rect width="512" height="512" rx="115" fill={fill} />
      <g stroke="#fff" strokeWidth="56" strokeLinecap="round">
        <line x1="168" y1="168" x2="344" y2="344" />
        <line x1="344" y1="168" x2="168" y2="344" />
      </g>
      {/* Portal-eye punched at the crossing. */}
      <circle cx="256" cy="256" r="40" fill={fill} />
      <circle cx="256" cy="256" r="15" fill="#fff" />
    </svg>
  );
}

export default function Logo({ size = 28, tile = "indigo", sub }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} tile={tile} />
      <span className="leading-tight">
        <span className="font-display block text-[15px] font-bold tracking-tight text-ink">
          x<span className={tile === "emerald" ? "text-accent-2" : "text-accent"}>Portal</span>
        </span>
        {sub && (
          <span className="font-data block text-[10px] font-medium uppercase tracking-widest text-ink-muted">
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}
