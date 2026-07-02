// The xPortal mark + wordmark. The mark is the split-x: the letter caught
// mid-way through a portal plane, far half already shifted.
// `tile` sets the background: indigo = client portal, emerald = operator console.
const TILES = { indigo: "#5b48ee", emerald: "#059669" };

export function LogoMark({ size = 28, tile = "indigo", className = "" }) {
  const fill = TILES[tile] || tile;
  const uid = `lm-${(TILES[tile] ? tile : "c") + String(fill).replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden>
      <rect width="512" height="512" rx="115" fill={fill} />
      <defs>
        <g id={`${uid}-x`} stroke="#ffffff" strokeWidth="64" strokeLinecap="round">
          <line x1="150" y1="150" x2="362" y2="362" />
          <line x1="362" y1="150" x2="150" y2="362" />
        </g>
        <clipPath id={`${uid}-l`}><rect x="0" y="0" width="249" height="512" /></clipPath>
        <clipPath id={`${uid}-r`}><rect x="267" y="0" width="245" height="512" /></clipPath>
      </defs>
      <use href={`#${uid}-x`} clipPath={`url(#${uid}-l)`} />
      <use href={`#${uid}-x`} clipPath={`url(#${uid}-r)`} transform="translate(0,-34)" />
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
