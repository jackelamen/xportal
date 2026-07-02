"use client";

import { useState } from "react";

export default function LoginForm({ kind = "client", accent }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestLink(e) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, kind }),
    });
    setBusy(false);
    setSent(true); // always confirm - never reveal whether the email exists
  }

  if (sent) {
    return (
      <p className="rounded-lg border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-ink">
        If that address is registered, a sign-in link is on its way. It expires in 15 minutes.
      </p>
    );
  }

  return (
    <form onSubmit={requestLink} className="space-y-4">
      <label className="block text-sm font-medium text-ink">
        Work email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="mt-1.5 w-full rounded-lg border border-line bg-bg-secondary px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
      </label>
      <button
        disabled={busy}
        style={accent ? { backgroundColor: accent } : undefined}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="text-xs text-ink-soft">No password. We'll email you a link that signs you in for 15 minutes.</p>
    </form>
  );
}
