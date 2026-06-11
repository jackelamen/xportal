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
    setSent(true); // always confirm — never reveal whether the email exists
  }

  if (sent) {
    return (
      <p className="mt-6 text-ink-soft">
        If that address is registered, a sign-in link is on its way. It expires in 15 minutes.
      </p>
    );
  }

  return (
    <form onSubmit={requestLink} className="mt-6 space-y-4">
      <label className="block text-sm text-ink-soft">
        Work email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="mt-1 w-full rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </label>
      <button
        disabled={busy}
        style={accent ? { backgroundColor: accent } : undefined}
        className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
