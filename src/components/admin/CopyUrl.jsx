"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Small copy-to-clipboard chip for a URL that's otherwise just plain text —
// used for the client admin URL that xPlan asks operators to paste in
// (to explicitly link a project to an already-existing xPortal client).
export default function CopyUrl({ url }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing to fall back to silently.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy this client's admin URL"
      className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-secondary px-2.5 py-1 font-data text-xs text-ink-soft hover:border-accent-2 hover:text-accent-2"
    >
      <span className="max-w-[280px] truncate">{url}</span>
      {copied ? <Check size={13} className="shrink-0 text-accent-2" /> : <Copy size={13} className="shrink-0" />}
    </button>
  );
}
