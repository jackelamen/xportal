import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import Logo from "@/components/Logo";
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
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-line bg-bg-secondary">
        <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
          <Link href="/admin">
            <Logo size={24} tile="emerald" sub="Operator console" />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav unreadCount={unreadCount} clients={clients} />
        </div>

        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-2 text-[11px] font-semibold text-white">
              {(operator.name || "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 truncate text-xs font-semibold text-ink">
              {operator.name}
            </span>
            <ThemeToggle />
            <form action="/api/auth/logout?kind=operator" method="post">
              <button title="Sign out" className="flex items-center text-ink-muted hover:text-danger">
                <LogOut size={14} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="ml-60 flex-1 min-w-0">
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </div>
    </div>
  );
}
