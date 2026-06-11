import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import { getOperatorSession } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const operator = await getOperatorSession();
  if (!operator) redirect("/admin/login");

  return (
    <div className="mx-auto min-h-screen max-w-6xl">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link href="/admin">
          <Logo size={26} tile="emerald" sub="Operator console" />
        </Link>
        <div className="flex items-center gap-4 text-sm text-ink-soft">
          <ThemeToggle />
          <span>{operator.name}</span>
          <form action="/api/auth/logout?kind=operator" method="post">
            <button className="flex items-center gap-1.5 text-ink-muted hover:text-ink">
              <LogOut size={15} /> Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
