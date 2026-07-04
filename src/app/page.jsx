import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import LoginShell from "@/components/LoginShell";
import Logo from "@/components/Logo";
import { t } from "@/lib/i18n";
import { getLoginLocale } from "@/lib/i18n/loginLocale";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const locale = await getLoginLocale();
  return (
    <LoginShell
      tile="indigo"
      locale={locale}
      eyebrow={t(locale, "login.eyebrow")}
      headline={t(locale, "login.headline")}
      blurb={t(locale, "login.blurb")}
    >
      <div className="mb-8">
        <Logo size={30} sub={t(locale, "nav.clientPortal")} />
      </div>
      <h2 className="text-2xl font-semibold text-ink">{t(locale, "login.signInHeadline")}</h2>
      <p className="mt-1.5 text-sm text-ink-soft">{t(locale, "login.signInBlurb")}</p>
      <div className="mt-7">
        <LoginForm kind="client" locale={locale} />
      </div>
      <p className="mt-8 border-t border-line pt-5 text-xs text-ink-muted">
        {t(locale, "login.operatorPrompt")}{" "}
        <Link href="/admin/login" className="font-medium text-accent hover:underline">
          {t(locale, "login.operatorLink")}
        </Link>
      </p>
    </LoginShell>
  );
}
