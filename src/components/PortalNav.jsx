"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Receipt, CalendarClock, CalendarDays, History,
} from "lucide-react";

const ICONS = { LayoutDashboard, Receipt, CalendarClock, CalendarDays, History };

// Client nav with an active state — the current page is always visible.
export default function PortalNav({ items, unread, variant = "sidebar" }) {
  const pathname = usePathname();
  const isActive = (href) =>
    href === "/portal" ? pathname === "/portal" || pathname.startsWith("/portal/projects") : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1 text-sm">
        {items.map(({ href, icon, label }) => {
          const Icon = ICONS[icon];
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={isActive(href) ? "page" : undefined}
              className={`rounded-lg p-3 ${
                isActive(href) ? "bg-bg-tertiary text-ink" : "text-ink-soft hover:bg-bg-tertiary hover:text-ink"
              }`}
            >
              <Icon size={18} />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {items.map(({ href, icon, label }, i) => {
        const Icon = ICONS[icon];
        const active = isActive(href);
        return (
          <span key={href}>
            {i === 1 && (
              <p className="font-data px-3 pb-1.5 pt-4 text-[10px] uppercase tracking-widest text-ink-muted">
                Workspace
              </p>
            )}
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                active
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-ink-soft hover:bg-bg-tertiary hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
              {label === "Home" && unread > 0 && (
                <span
                  title={`${unread} unread message${unread > 1 ? "s" : ""} from the team`}
                  className="font-data ml-auto rounded-full bg-accent px-1.5 text-xs font-semibold text-white"
                >
                  {unread}
                </span>
              )}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
