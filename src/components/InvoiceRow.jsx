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
    toast("Dispute submitted — the team will follow up with you.");
    setDisputing(false);
    router.refresh();
  }

  return (
    <>
      <tr className="border-t border-line">
        <td className="px-4 py-3 font-medium">{invoice.invoice_number}</td>
        <td className="px-4 py-3 text-ink-soft">{invoice.project_title}</td>
        <td className="px-4 py-3 text-ink-soft">{invoice.issued_date}</td>
        <td className="px-4 py-3 text-ink-soft">{invoice.due_date}</td>
        <td className="px-4 py-3 text-right">${Number(invoice.amount).toFixed(2)}</td>
        <td className={`px-4 py-3 font-medium ${STATUS_STYLE[invoice.status] || ""}`}>
          {invoice.status}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3">
            {(invoice.status === "Unpaid" || invoice.status === "Overdue") && (
              <button
                onClick={() => setDisputing(true)}
                className="inline-flex items-center gap-1 text-ink-muted hover:text-dispute"
                title="Question this invoice"
              >
                <ShieldQuestion size={14} /> Dispute
              </button>
            )}
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <Download size={14} /> PDF
            </a>
          </div>
        </td>
      </tr>
      {invoice.status === "Disputed" && invoice.dispute_reason && (
        <tr className="border-t border-line/50 bg-bg-primary/40">
          <td colSpan={7} className="px-4 py-2 text-xs text-dispute">
            Under dispute: {invoice.dispute_reason} — escalation is paused while we review.
          </td>
        </tr>
      )}
      {disputing && (
        <tr className="border-t border-line/50 bg-bg-primary/40">
          <td colSpan={7} className="px-4 py-3">
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
          </td>
        </tr>
      )}
    </>
  );
}
