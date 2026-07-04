import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import LoginForm from "@/components/LoginForm";
import LoginShell from "@/components/LoginShell";
import { isDataLogo } from "@/lib/logo";
import { t } from "@/lib/i18n";
import { getLoginLocale } from "@/lib/i18n/loginLocale";

export const dynamic = "force-dynamic";

// White-labeled login: /p/acme shows the client's logo and accent color.
export default async function BrandedLoginPage({ params }) {
  const { slug } = await params;
  const client = (await sql(
    "SELECT company_name, logo_path, accent_color FROM clients WHERE slug = ? AND archived_at IS NULL",
    [slug]
  ))[0];
  if (!client) notFound();
  const locale = await getLoginLocale();

  return (
    <LoginShell
      tile="indigo"
      locale={locale}
      accentColor={client.accent_color}
      logoSrc={client.logo_path ? (isDataLogo(client.logo_path) ? client.logo_path : `/api/public-logo/${slug}`) : undefined}
      logoAlt={client.company_name}
      eyebrow={t(locale, "login.brandedEyebrow")}
      headline={t(locale, "login.headline")}
      blurb={t(locale, "login.blurb")}
    >
      {!client.logo_path && (
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-widest"
          style={{ color: client.accent_color || "#5b48ee" }}
        >
          {client.company_name}
        </p>
      )}
      <h2 className="text-2xl font-semibold text-ink">{t(locale, "login.signInHeadline")}</h2>
      <p className="mt-1.5 text-sm text-ink-soft">{t(locale, "login.signInBlurb")}</p>
      <div className="mt-7">
        <LoginForm kind="client" accent={client.accent_color} locale={locale} />
      </div>
    </LoginShell>
  );
}
