import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getClientSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import Toaster from "@/components/Toaster";
import ThemeToggle from "@/components/ThemeToggle";
import PortalNav from "@/components/PortalNav";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/portal", icon: "LayoutDashboard", label: "Home" },
  { href: "/portal/calendar", icon: "CalendarDays", label: "Calendar" },
  { href: "/portal/billing", icon: "Receipt", label: "Billing" },
  { href: "/portal/schedule", icon: "CalendarClock", label: "Schedule" },
  { href: "/portal/activity", icon: "History", label: "Activity" },
];

export default async function PortalLayout({ children }) {
  const session = await getClientSession();
  if (!session) redirect("/");
  const { user, client } = session;

  const { n: unread } = (await sql(
    `SELECT COUNT(*)::int AS n FROM communication_threads t
     JOIN portal_projects p ON p.id = t.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 AND t.sender_type = 'Internal_Operator' AND t.is_read = 0`,
    [client.id]
  ))[0];

  return (
    // Per-client branding: accent color cascades into every bg-accent/text-accent
    // utility — including inside the always-dark sidebar.
    <div style={client.accent_color ? { "--accent": client.accent_color } : undefined}>
      {session.preview && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-warn px-4 py-2 text-sm font-medium text-white">
          Previewing as {client.company_name} ({user.name}) — read-only, actions are disabled
          <form action="/api/admin/preview" method="post">
            <input type="hidden" name="_action" value="exit" />
            <button className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30">
              Exit preview
            </button>
          </form>
        </div>
      )}
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Mobile top bar (dark, to match the sidebar identity) */}
        <header className="flex items-center justify-between bg-[#0b0d13] p-4 text-white md:hidden">
          <BrandMark client={client} compact />
          <div className="flex items-center gap-1">
            <PortalNav items={NAV} unread={unread} variant="mobile" />
          </div>
        </header>

        {/* Desktop sidebar: always-dark surface, pinned to the viewport edge. */}
        <aside className="hidden w-[250px] shrink-0 flex-col bg-[#0b0d13] text-white md:sticky md:top-0 md:flex md:h-screen">
          <div className="px-5 py-5">
            <BrandMark client={client} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <PortalNav items={NAV} unread={unread} />
          </div>
          <div className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white ring-1 ring-white/15">
              {(user.name || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <form action="/api/auth/logout" method="post">
                <button className="flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white">
                  <LogOut size={12} /> Sign out
                </button>
              </form>
            </div>
            <ThemeToggle className="text-white/60 hover:bg-white/10 hover:text-white" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-5xl p-5 md:px-10 md:py-8">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

// xPortal identity on top; the client's identity right under it — their
// uploaded logo when they have one, their name otherwise. Rendered on the
// dark sidebar surface.
function BrandMark({ client, compact = false }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <LogoMark size={compact ? 26 : 28} tile="indigo" />
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold tracking-tight text-white">
            x<span className="text-accent">Portal</span>
          </div>
          {!compact && (
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">Client portal</div>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-4 border-t border-white/[0.08] pt-3.5">
          {client.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/${client.logo_path.replace(/^uploads\//, "files/")}`}
              alt={client.company_name}
              className="h-7 max-w-40 object-contain object-left opacity-90"
            />
          ) : (
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {client.company_name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
