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
          ? "bg-bg-tertiary font-medium text-ink"
          : "text-ink-soft hover:bg-bg-tertiary hover:text-ink"
      }`}
    >
      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-accent-2" : ""} />
      <span className="flex-1 truncate">{label}</span>
      {!!badge && (
        <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold leading-tight text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function AdminNav({ unreadCount }) {
  return (
    <nav className="space-y-0.5">
      <NavItem href="/admin" icon={LayoutDashboard} label="Dashboard" badge={unreadCount} exact />
      <NavItem href="/admin/settings" icon={Settings} label="Settings" />
    </nav>
  );
}
