"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OperatorLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/operator-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error || "Sign-in failed");
    setBusy(false);
  }

  return (
    <form onSubmit={signIn} className="mt-6 space-y-4">
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
      <label className="block text-sm text-ink-soft">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your xPM password"
          className="mt-1 w-full rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-ink-soft">Use the same email and password as your xPM account.</p>
    </form>
  );
}
