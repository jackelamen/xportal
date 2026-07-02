import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import LoginForm from "@/components/LoginForm";
import LoginShell from "@/components/LoginShell";

export const dynamic = "force-dynamic";

// White-labeled login: /p/acme shows the client's logo and accent color.
export default async function BrandedLoginPage({ params }) {
  const { slug } = await params;
  const client = (await sql(
    "SELECT company_name, logo_path, accent_color FROM clients WHERE slug = ? AND archived_at IS NULL",
    [slug]
  ))[0];
  if (!client) notFound();

  return (
    <LoginShell
      tile="indigo"
      accentColor={client.accent_color}
      logoSrc={client.logo_path ? `/api/public-logo/${slug}` : undefined}
      logoAlt={client.company_name}
      eyebrow={`Client portal · powered by xPortal`}
      headline="Your project, your progress, in one place."
      blurb="Review deliverables, follow progress, and stay in sync with your team, all in real time."
    >
      {!client.logo_path && (
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-widest"
          style={{ color: client.accent_color || "#5b48ee" }}
        >
          {client.company_name}
        </p>
      )}
      <h2 className="text-2xl font-semibold text-ink">Sign in to your workspace</h2>
      <p className="mt-1.5 text-sm text-ink-soft">Review progress, deliverables, and billing in one place.</p>
      <div className="mt-7">
        <LoginForm kind="client" accent={client.accent_color} />
      </div>
    </LoginShell>
  );
}
