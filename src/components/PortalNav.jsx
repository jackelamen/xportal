"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Receipt, CalendarClock, CalendarDays,
} from "lucide-react";

const ICONS = { LayoutDashboard, Receipt, CalendarClock, CalendarDays };

// Client nav with an active state - the current page is always visible.
export default function PortalNav({ items, unread, unreadTitle, variant = "sidebar" }) {
  const pathname = usePathname();
  const isActive = (href) =>
    href === "/portal" ? pathname === "/portal" || pathname.startsWith("/portal/projects") : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <nav className="flex min-w-0 gap-0.5 overflow-x-auto text-sm">
        {items.map(({ href, icon, label }) => {
          const Icon = ICONS[icon];
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex shrink-0 flex-col items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2 ${
                isActive(href) ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon size={17} />
              <span className="text-[9px] font-medium uppercase tracking-wide leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  // Dark sidebar: caps labels, indigo active state with a right-edge accent tab.
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, icon, label }) => {
        const Icon = ICONS[icon];
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors ${
              active ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/90"
            }`}
          >
            {active && <span className="absolute right-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent" />}
            <Icon size={16} strokeWidth={active ? 2.1 : 1.9} className={active ? "text-accent" : ""} />
            <span className="flex-1">{label}</span>
            {href === "/portal" && unread > 0 && (
              <span
                title={unreadTitle}
                className="font-mono rounded-full bg-accent px-1.5 text-[10px] font-semibold normal-case tracking-normal text-white"
              >
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
