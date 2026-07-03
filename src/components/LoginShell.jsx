import { LogoMark } from "./Logo";
import LoginLocaleToggle from "./LoginLocaleToggle";
import { t } from "@/lib/i18n";

// Shared split-panel login shell: a dark brand panel (always-dark regardless
// of site theme - wrapped in a locally-scoped "dark" class so bg/ink tokens
// resolve to their dark values) plus a form panel on the right. Used by the
// operator, root client, and per-client-branded sign-in pages. `locale` is only
// passed on the client-facing pages; the operator page leaves it undefined so
// the language switcher never appears there.
export default function LoginShell({ tile = "indigo", eyebrow, headline, blurb, logoSrc, logoAlt, accentColor, locale, children }) {
  return (
    <main className="flex min-h-screen w-full">
      <div className="dark relative hidden flex-1 flex-col justify-between overflow-hidden bg-bg-primary p-10 text-ink md:flex lg:p-14">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-accent-2/25 blur-[110px]" />
        <div
          className={`pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full blur-[110px] ${accentColor ? "" : "bg-accent/25"}`}
          style={accentColor ? { backgroundColor: accentColor, opacity: 0.28 } : undefined}
        />

        <div className="relative flex items-center gap-2.5">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={logoAlt} className="h-8 max-w-44 object-contain object-left" />
          ) : (
            <>
              <LogoMark size={30} tile={tile} />
              <span className="font-display text-base font-bold tracking-tight text-ink">
                x<span className={tile === "emerald" ? "text-accent-2" : "text-accent"}>Portal</span>
              </span>
            </>
          )}
        </div>

        <div className="relative">
          <p className="font-data text-[11px] uppercase tracking-widest text-ink-muted">{eyebrow}</p>
          <h1 className="mt-3.5 max-w-[11ch] text-[2.4rem] font-bold leading-[1.08] tracking-tight text-ink">
            {headline}
          </h1>
          <p className="mt-4 max-w-[38ch] text-sm leading-relaxed text-ink-soft">{blurb}</p>
        </div>

        <p className="font-data relative text-[11px] text-ink-muted">
          {locale ? t(locale, "login.copyright", { year: new Date().getFullYear() }) : `© ${new Date().getFullYear()} xPortal`}
        </p>
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center bg-bg-primary p-8 md:w-[440px] md:flex-none">
        {locale && (
          <div className="absolute right-6 top-6">
            <LoginLocaleToggle locale={locale} />
          </div>
        )}
        <div className="w-full max-w-[340px]">{children}</div>
      </div>
    </main>
  );
}
