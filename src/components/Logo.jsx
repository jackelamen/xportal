// The xPortal mark: a gateway/portal arch. A doorway you step through, with a
// lit threshold orb at its centre - a portal into the engagement.
// `tile` sets the background: indigo = client portal, emerald = operator console.
const TILES = { indigo: "#5b48ee", emerald: "#059669" };

export function LogoMark({ size = 28, tile = "indigo", className = "" }) {
  const fill = TILES[tile] || tile;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden>
      <rect width="512" height="512" rx="115" fill={fill} />
      {/* Outer doorway silhouette. */}
      <path d="M150 392 L150 246 A106 106 0 0 1 362 246 L362 392 Z" fill="#fff" />
      {/* Inner opening (punched back to the tile colour) leaves an arch frame. */}
      <path d="M202 392 L202 250 A54 54 0 0 1 310 250 L310 392 Z" fill={fill} />
      {/* Lit threshold orb. */}
      <circle cx="256" cy="300" r="28" fill="#fff" />
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
