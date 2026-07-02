"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldQuestion } from "lucide-react";
import { toast } from "@/components/Toaster";

const STATUS_STYLE = {
  Paid: "text-accent-2",
  Unpaid: "text-warn",
  Overdue: "text-danger",
  Disputed: "text-dispute",
};

export default function InvoiceRow({ invoice }) {
  const router = useRouter();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitDispute() {
    setBusy(true);
    const res = await fetch(`/api/invoices/${invoice.id}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error((await res.json()).error || "Could not submit dispute");
      return;
    }
    toast("Dispute submitted. The team will follow up with you.");
    setDisputing(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 text-sm">
        <span className="font-data font-semibold text-ink">{invoice.invoice_number}</span>
        <span className="text-ink-soft">{invoice.project_title}</span>
        <span className="font-data text-xs text-ink-muted">{invoice.issued_date} → {invoice.due_date}</span>
        <span className="font-data ml-auto font-medium text-ink">${Number(invoice.amount).toFixed(2)}</span>
        <span className={`font-data w-20 text-right text-xs font-semibold ${STATUS_STYLE[invoice.status] || ""}`}>
          {invoice.status}
        </span>
        <div className="flex items-center gap-3">
          {(invoice.status === "Unpaid" || invoice.status === "Overdue") && (
            <button
              onClick={() => setDisputing(true)}
              className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-dispute"
              title="Question this invoice"
            >
              <ShieldQuestion size={13} /> Dispute
            </button>
          )}
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Download size={13} /> PDF
          </a>
        </div>
      </div>
      {invoice.status === "Disputed" && invoice.dispute_reason && (
        <p className="bg-dispute/5 px-4 pb-3 text-xs text-dispute">
          Under dispute: {invoice.dispute_reason}. Escalation is paused while we review.
        </p>
      )}
      {disputing && (
        <div className="bg-bg-primary/40 px-4 pb-4">
          <p className="text-sm text-ink-soft">
            Tell us what looks wrong with <strong className="text-ink">{invoice.invoice_number}</strong>.
            This pauses the invoice and opens a thread with the team.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. We were quoted 12 hours for this phase, but the invoice shows 20."
            className="mt-2 w-full rounded-lg border border-line bg-bg-tertiary p-2 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy || !reason.trim()}
              onClick={submitDispute}
              className="rounded-lg bg-dispute px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit dispute"}
            </button>
            <button onClick={() => setDisputing(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
