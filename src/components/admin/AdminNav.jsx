"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutDashboard, Settings, Users } from "lucide-react";

// Dark sidebar: caps labels, emerald active state with a right-edge accent
// tab - mirrors the client portal's PortalNav, but accent-2 (emerald) instead
// of accent (indigo), since admin keeps its own identity color.
function NavItem({ href, icon: Icon, label, badge, exact = false }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors ${
        active ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/90"
      }`}
    >
      {active && <span className="absolute right-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-2" />}
      <Icon size={16} strokeWidth={active ? 2.1 : 1.9} className={active ? "text-accent-2" : ""} />
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className="font-mono rounded-full bg-accent px-1.5 text-[10px] font-semibold normal-case tracking-normal text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

const DOT_COLOR = ["bg-accent-2", "bg-accent", "bg-warn", "bg-dispute", "bg-danger"];

export default function AdminNav({ unreadCount, clients = [], pendingBookingsCount }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      <NavItem href="/admin" icon={LayoutDashboard} label="Dashboard" badge={unreadCount} exact />

      {clients.length > 0 && (
        <>
          <p className="font-mono px-3 pb-1.5 pt-4 text-[10px] uppercase tracking-widest text-white/35">
            Clients
          </p>
          {clients.map((c, i) => {
            const active = pathname.startsWith(`/admin/clients/${c.id}`);
            return (
              <Link
                key={c.id}
                href={`/admin/clients/${c.id}`}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-medium normal-case tracking-normal transition-colors ${
                  active ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/90"
                }`}
              >
                {active && <span className="absolute right-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-2" />}
                <span className={`h-1.5 w-1.5 shrink-0 rounded-sm ${DOT_COLOR[i % DOT_COLOR.length]}`} />
                <span className="flex-1 truncate">{c.company_name}</span>
              </Link>
            );
          })}
        </>
      )}

      <p className="font-mono px-3 pb-1.5 pt-4 text-[10px] uppercase tracking-widest text-white/35">
        Console
      </p>
      <NavItem href="/admin/bookings" icon={CalendarClock} label="Bookings" badge={pendingBookingsCount} />
      <NavItem href="/admin/team" icon={Users} label="Team" />
      <NavItem href="/admin/settings" icon={Settings} label="Settings" />
    </nav>
  );
}
