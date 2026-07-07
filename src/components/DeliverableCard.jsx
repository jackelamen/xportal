"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, X, ExternalLink, FileText, History, Eye, EyeOff, ThumbsUp, MessageSquareWarning,
} from "lucide-react";
import { toast } from "@/components/Toaster";
import { t as translate } from "@/lib/i18n";

// A colored dot plus a status label in the status color reads state instantly
// without the generic filled-pill look.
const STATUS = {
  Pending: { dot: "bg-warn", text: "text-warn", key: "deliverable.statusPending" },
  Approved: { dot: "bg-accent-2", text: "text-accent-2", key: "deliverable.statusApproved" },
  "Revisions Requested": { dot: "bg-danger", text: "text-danger", key: "deliverable.statusRevisions" },
};

const assetHref = (v) =>
  v.kind === "file" ? `/api/${v.asset_path.replace(/^uploads\//, "files/")}` : v.asset_path;

// Uploaded files render inline when the browser can show them natively.
// External links never preview - most sites refuse to be embedded.
const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
function previewKind(v) {
  if (v?.kind !== "file") return null;
  const ext = (v.original_name || v.asset_path || "").toLowerCase().split(".").pop();
  if (IMAGE_EXT.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return null;
}

export default function DeliverableCard({ deliverable, locale = "en" }) {
  const router = useRouter();
  const t = (key, vars) => translate(locale, key, vars);
  // Two-step decision: pick an action (toggle), then confirm it. A stray
  // click can never approve anything.
  const [choice, setChoice] = useState(null); // null | "approve" | "revise"
  const [showHistory, setShowHistory] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const current = deliverable.versions[0];
  const history = deliverable.versions.slice(1);
  const preview = previewKind(current);
  // Pending work opens with the preview visible - the review and the decision
  // belong on one screen. Decided deliverables start collapsed.
  const [showPreview, setShowPreview] = useState(
    Boolean(preview) && deliverable.status === "Pending"
  );

  function markViewed() {
    if (current && !current.viewed_at) {
      fetch(`/api/deliverables/${deliverable.id}/viewed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: current.id }),
      });
    }
  }

  // Rendering the preview counts as viewing the work.
  useEffect(() => {
    if (showPreview) markViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  async function act(action) {
    setBusy(true);
    const res = await fetch(`/api/deliverables/${deliverable.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, feedback_notes: notes }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error((await res.json()).error || t("deliverable.toastError"));
      return;
    }
    toast(action === "approve" ? t("deliverable.toastApproved") : t("deliverable.toastRevisionSent"));
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
        {(() => {
          const s = STATUS[deliverable.status];
          return (
            <span className={`inline-flex shrink-0 items-center gap-2 text-xs font-medium ${s?.text || "text-ink-soft"}`}>
              <span className={`h-2 w-2 rounded-full ${s?.dot || "bg-ink-muted"}`} />
              {s ? t(s.key) : deliverable.status}
              {deliverable.actioned_by ? <span className="text-ink-muted">· {deliverable.actioned_by}</span> : ""}
            </span>
          );
        })()}
      </div>

      {/* The thing to review: inline when the browser can render it, with the
          open-in-tab link alongside; just the link otherwise. */}
      {current && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={assetHref(current)}
            target="_blank"
            rel="noreferrer"
            onClick={markViewed}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-bg-primary px-3 py-2 text-sm font-medium text-accent hover:border-accent"
          >
            <FileText size={14} />
            {current.kind === "file" ? t("deliverable.openFile", { name: current.original_name || "document" }) : t("deliverable.viewWork")}
            <ExternalLink size={12} className="text-ink-muted" />
          </a>
          {preview && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink-soft hover:border-accent hover:text-ink"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {t(showPreview ? "deliverable.hidePreview" : "deliverable.showPreview")}
            </button>
          )}
        </div>
      )}

      {preview && showPreview && (
        <div className="mt-3 overflow-hidden rounded-lg border border-line bg-bg-tertiary">
          {preview === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetHref(current)}
              alt={current.original_name || deliverable.title}
              className="mx-auto max-h-[32rem] w-auto max-w-full"
            />
          ) : (
            <iframe
              src={`${assetHref(current)}#toolbar=0`}
              title={current.original_name || deliverable.title}
              className="h-[36rem] w-full bg-white"
            />
          )}
        </div>
      )}

      {deliverable.feedback_notes && (
        <p className="mt-3 rounded-lg bg-bg-tertiary px-3 py-2 text-sm text-ink-soft">
          {t("deliverable.yourFeedback", { notes: deliverable.feedback_notes })}
        </p>
      )}

      {/* Decision area: choose, then confirm. */}
      {deliverable.status === "Pending" && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="font-data text-[10.5px] font-medium uppercase tracking-widest text-ink-muted">{t("deliverable.yourDecision")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {toggleBtn("approve", t("deliverable.approve"), ThumbsUp)}
            {toggleBtn("revise", t("deliverable.requestChanges"), MessageSquareWarning)}
          </div>

          {choice === "approve" && (
            <div className="mt-3 rounded-lg border border-accent-2/30 bg-accent-2/5 p-3 text-sm">
              <p className="text-ink-soft">
                {t("deliverable.approvingIsFinal")}
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => act("approve")}
                  className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  {busy ? t("deliverable.approving") : t("deliverable.confirmApproval")}
                </button>
                <button onClick={() => setChoice(null)} className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-ink-soft hover:text-ink">
                  <X size={13} /> {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {choice === "revise" && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
              <label className="block text-ink-soft">
                {t("deliverable.whatShouldChange")} <span className="text-ink-muted">{t("deliverable.whatShouldChangeHint")}</span>
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
                  {busy ? t("deliverable.sending") : t("deliverable.sendRevisionRequest")}
                </button>
                <button onClick={() => setChoice(null)} className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-ink-soft hover:text-ink">
                  <X size={13} /> {t("common.cancel")}
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
            <History size={12} /> {t(showHistory ? "deliverable.hideVersions" : "deliverable.showVersions", { n: history.length, plural: history.length > 1 ? "s" : "" })}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5 rounded-lg bg-bg-tertiary p-3 text-xs text-ink-soft">
              {history.map((v) => (
                <li key={v.id} className="flex items-center gap-2">
                  <span className="font-data text-ink-muted">v{v.version_no}</span>
                  <a href={assetHref(v)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {v.kind === "file" ? v.original_name || "document" : "link"}
                  </a>
                  {v.note && <span className="truncate">· {v.note}</span>}
                  {v.viewed_at && (
                    <span className="ml-auto flex items-center gap-1 text-ink-muted"><Eye size={11} /> {t("deliverable.viewed")}</span>
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
