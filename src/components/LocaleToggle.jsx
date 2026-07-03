"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// EN/KO switcher for the client portal sidebar. Persists to client_users.locale
// (server-authoritative, so it's remembered across sessions) and refreshes the
// current route so every server component re-renders in the new language.
export default function LocaleToggle({ locale, className = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = locale === "ko" ? "en" : "ko";

  async function switchLocale() {
    if (busy) return;
    setBusy(true);
    await fetch("/api/auth/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={switchLocale}
      disabled={busy}
      aria-label={locale === "ko" ? "Switch to English" : "한국어로 전환"}
      title={locale === "ko" ? "Switch to English" : "한국어로 전환"}
      className={`font-mono rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted hover:bg-bg-tertiary hover:text-ink disabled:opacity-50 ${className}`}
    >
      {next === "ko" ? "한국어" : "EN"}
    </button>
  );
}
