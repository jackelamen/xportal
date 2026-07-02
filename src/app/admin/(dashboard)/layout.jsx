import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { getOperatorSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import AdminNav from "@/components/admin/AdminNav";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const operator = await getOperatorSession();
  if (!operator) redirect("/admin/login");

  const seenRows = await sql(
    "SELECT value FROM app_settings WHERE key = 'operator_seen_activity_at'"
  );
  const seenTs = Date.parse(seenRows[0]?.value) || 0;
  const unreadRows = await sql(
    "SELECT COUNT(*)::int AS n FROM activity_log WHERE actor_type = 'client' AND created_at > ?",
    [new Date(seenTs).toISOString()]
  );
  const unreadCount = unreadRows[0]?.n ?? 0;

  const clients = await sql(
    "SELECT id, company_name FROM clients WHERE archived_at IS NULL ORDER BY company_name LIMIT 8"
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar (dark, to match the sidebar identity) */}
      <header className="flex items-center justify-between bg-[#0b0d13] p-4 text-white md:hidden">
        <Link href="/admin" className="flex items-center gap-2.5">
          <LogoMark size={26} tile="emerald" />
          <span className="font-display text-[15px] font-semibold tracking-tight text-white">
            x<span className="text-accent-2">Portal</span>
          </span>
        </Link>
      </header>

      {/* Desktop sidebar: always-dark surface, pinned to the viewport edge — mirrors PortalLayout. */}
      <aside className="hidden w-[250px] shrink-0 flex-col bg-[#0b0d13] text-white md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-5 py-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <LogoMark size={28} tile="emerald" />
            <div className="leading-tight">
              <div className="font-display text-[15px] font-semibold tracking-tight text-white">
                x<span className="text-accent-2">Portal</span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">Operator console</div>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <AdminNav unreadCount={unreadCount} clients={clients} />
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-2 text-[11px] font-semibold text-white ring-1 ring-white/15">
            {(operator.name || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium">{operator.name}</p>
            <form action="/api/auth/logout?kind=operator" method="post">
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
  );
}
