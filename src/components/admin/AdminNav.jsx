"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings } from "lucide-react";

function NavItem({ href, icon: Icon, label, badge, exact = false }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-accent-2/10 font-semibold text-accent-2"
          : "text-ink-soft hover:bg-bg-tertiary hover:text-ink"
      }`}
    >
      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1 truncate">{label}</span>
      {!!badge && (
        <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold leading-tight text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

const DOT_COLOR = ["bg-accent", "bg-danger", "bg-warn", "bg-accent-2", "bg-dispute"];

export default function AdminNav({ unreadCount, clients = [] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      <NavItem href="/admin" icon={LayoutDashboard} label="Dashboard" badge={unreadCount} exact />

      {clients.length > 0 && (
        <>
          <p className="font-data px-3 pb-1.5 pt-4 text-[10px] uppercase tracking-widest text-ink-muted">
            Clients
          </p>
          {clients.map((c, i) => {
            const active = pathname.startsWith(`/admin/clients/${c.id}`);
            return (
              <Link
                key={c.id}
                href={`/admin/clients/${c.id}`}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-accent-2/10 font-semibold text-accent-2" : "text-ink-soft hover:bg-bg-tertiary hover:text-ink"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-sm ${DOT_COLOR[i % DOT_COLOR.length]}`} />
                <span className="flex-1 truncate">{c.company_name}</span>
              </Link>
            );
          })}
        </>
      )}

      <p className="font-data px-3 pb-1.5 pt-4 text-[10px] uppercase tracking-widest text-ink-muted">
        Console
      </p>
      <NavItem href="/admin/settings" icon={Settings} label="Settings" />
    </nav>
  );
}
