"use client";

// Pre-auth language switcher: there's no client_users row to persist to yet, so
// it writes a cookie the login pages read on the next render, then reloads.
export default function LoginLocaleToggle({ locale }) {
  const next = locale === "ko" ? "en" : "ko";

  function switchLocale() {
    document.cookie = `xportal_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <button
      onClick={switchLocale}
      aria-label={locale === "ko" ? "Switch to English" : "한국어로 전환"}
      className="font-data rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:border-accent hover:text-ink"
    >
      {next === "ko" ? "한국어" : "EN"}
    </button>
  );
}
