import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getClientSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import Toaster from "@/components/Toaster";
import ThemeToggle from "@/components/ThemeToggle";
import PortalNav from "@/components/PortalNav";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/portal", icon: "LayoutDashboard", label: "Home" },
  { href: "/portal/calendar", icon: "CalendarDays", label: "Calendar" },
  { href: "/portal/billing", icon: "Receipt", label: "Billing" },
  { href: "/portal/schedule", icon: "CalendarClock", label: "Book a meeting" },
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
    // Per-client branding: accent color cascades into every bg-accent/text-accent utility.
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
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-line bg-bg-secondary p-4 md:hidden">
          <BrandMark client={client} compact />
          <div className="flex items-center gap-1"><PortalNav items={NAV} unread={unread} variant="mobile" /><ThemeToggle /></div>
        </header>

        {/* Desktop sidebar: its own surface, pinned to the viewport edge. */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-bg-secondary md:sticky md:top-0 md:flex md:h-screen">
          <div className="border-b border-line px-5 py-5">
            <BrandMark client={client} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <PortalNav items={NAV} unread={unread} />
          </div>
          <div className="flex items-start justify-between border-t border-line px-5 py-4">
            <div className="min-w-0">
            <p className="truncate text-sm text-ink">{user.name}</p>
            <form action="/api/auth/logout" method="post" className="mt-1.5">
              <button className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
                <LogOut size={13} /> Sign out
              </button>
            </form>
            </div>
            <ThemeToggle />
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

// xPortal identity on top (indigo tile); the client's identity right under it
// — their uploaded logo when they have one, their name otherwise.
function BrandMark({ client, compact = false }) {
  return (
    <div>
      <Logo size={compact ? 24 : 28} sub={compact ? undefined : "Client portal"} />
      {!compact && (
        <div className="mt-3 border-t border-line pt-3">
          {client.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/${client.logo_path.replace(/^uploads\//, "files/")}`}
              alt={client.company_name}
              className="h-7 max-w-40 object-contain object-left"
            />
          ) : (
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              {client.company_name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
