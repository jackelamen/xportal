"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, X, ExternalLink, FileText, History, Eye, ThumbsUp, MessageSquareWarning,
} from "lucide-react";
import { toast } from "@/components/Toaster";

// Status pills use the colored-glass treatment so state reads instantly.
const STATUS_PILL = {
  Pending: "border-warn/30 bg-warn/10 text-warn",
  Approved: "border-accent-2/30 bg-accent-2/10 text-accent-2",
  "Revisions Requested": "border-danger/30 bg-danger/10 text-danger",
};

const assetHref = (v) =>
  v.kind === "file" ? `/api/${v.asset_path.replace(/^uploads\//, "files/")}` : v.asset_path;

export default function DeliverableCard({ deliverable }) {
  const router = useRouter();
  // Two-step decision: pick an action (toggle), then confirm it. A stray
  // click can never approve anything.
  const [choice, setChoice] = useState(null); // null | "approve" | "revise"
  const [showHistory, setShowHistory] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const current = deliverable.versions[0];
  const history = deliverable.versions.slice(1);

  function markViewed() {
    if (current && !current.viewed_at) {
      fetch(`/api/deliverables/${deliverable.id}/viewed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: current.id }),
      });
    }
  }

  async function act(action) {
    setBusy(true);
    const res = await fetch(`/api/deliverables/${deliverable.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, feedback_notes: notes }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error((await res.json()).error || "Something went wrong");
      return;
    }
    toast(
      action === "approve"
        ? "Approved — the team has been notified."
        : "Revision request sent to the team."
    );
    setChoice(null);
    router.refresh();
  }

  const toggleBtn = (value, label, Icon) => {
    const selected = choice === value;
    const tone =
      value === "approve"
        ? selected
          ? "border-accent-2 bg-accent-2/10 text-accent-2"
          : "border-line text-ink-soft hover:border-accent-2/50 hover:text-ink"
        : selected
          ? "border-danger bg-danger/10 text-danger"
          : "border-line text-ink-soft hover:border-danger/50 hover:text-ink";
    return (
      <button
        onClick={() => setChoice(selected ? null : value)}
        aria-pressed={selected}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${tone}`}
      >
        <Icon size={14} /> {label}
        {selected && <Check size={13} className="ml-0.5" />}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-line bg-bg-secondary p-5">
      {/* Identity row: what it is, which version, where it stands. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            <span className="truncate">{deliverable.title}</span>
            {deliverable.versions.length > 1 && (
              <span className="font-data rounded bg-bg-tertiary px-1.5 py-0.5 text-[11px] text-ink-soft">
                v{current.version_no}
              </span>
            )}
          </p>
          {current?.note && <p className="mt-1 text-sm text-ink-soft">{current.note}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_PILL[deliverable.status] || "border-line text-ink-soft"}`}>
          {deliverable.status}
          {deliverable.actioned_by ? ` · ${deliverable.actioned_by}` : ""}
        </span>
      </div>

      {/* The thing to review, as an obvious button. */}
      {current && (
        <a
          href={assetHref(current)}
          target="_blank"
          rel="noreferrer"
          onClick={markViewed}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-bg-primary px-3 py-2 text-sm font-medium text-accent hover:border-accent"
        >
          <FileText size={14} />
          {current.kind === "file" ? `Open ${current.original_name || "document"}` : "View the work"}
          <ExternalLink size={12} className="text-ink-muted" />
        </a>
      )}

      {deliverable.feedback_notes && (
        <p className="mt-3 rounded-lg bg-bg-tertiary px-3 py-2 text-sm text-ink-soft">
          Your feedback: {deliverable.feedback_notes}
        </p>
      )}

      {/* Decision area: choose, then confirm. */}
      {deliverable.status === "Pending" && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Your decision</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {toggleBtn("approve", "Approve", ThumbsUp)}
            {toggleBtn("revise", "Request changes", MessageSquareWarning)}
          </div>

          {choice === "approve" && (
            <div className="mt-3 rounded-lg border border-accent-2/30 bg-accent-2/5 p-3 text-sm">
              <p className="text-ink-soft">
                Approving is final — it locks this deliverable and notifies the team.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => act("approve")}
                  className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Approving…" : "Confirm approval"}
                </button>
                <button onClick={() => setChoice(null)} className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-ink-soft hover:text-ink">
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          )}

          {choice === "revise" && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
              <label className="block text-ink-soft">
                What should change? <span className="text-ink-muted">(required — the team sees this verbatim)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-line bg-bg-secondary p-2.5 text-ink outline-none focus:border-accent"
                />
              </label>
              <div className="mt-2.5 flex gap-2">
                <button
                  disabled={busy || !notes.trim()}
                  onClick={() => act("request_revisions")}
                  className="rounded-lg bg-danger px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send revision request"}
                </button>
                <button onClick={() => setChoice(null)} className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-ink-soft hover:text-ink">
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <History size={12} /> {showHistory ? "Hide" : "Show"} {history.length} previous version{history.length > 1 ? "s" : ""}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5 rounded-lg bg-bg-tertiary p-3 text-xs text-ink-soft">
              {history.map((v) => (
                <li key={v.id} className="flex items-center gap-2">
                  <span className="font-data text-ink-muted">v{v.version_no}</span>
                  <a href={assetHref(v)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {v.kind === "file" ? v.original_name || "document" : "link"}
                  </a>
                  {v.note && <span className="truncate">— {v.note}</span>}
                  {v.viewed_at && (
                    <span className="ml-auto flex items-center gap-1 text-ink-muted"><Eye size={11} /> viewed</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
