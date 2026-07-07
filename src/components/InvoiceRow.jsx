"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldQuestion } from "lucide-react";
import { toast } from "@/components/Toaster";
import { t as translate, formatDate } from "@/lib/i18n";
import Money from "@/components/Money";

const STATUS_STYLE = {
  Paid: "text-accent-2",
  Unpaid: "text-warn",
  Overdue: "text-danger",
  Disputed: "text-dispute",
};

export default function InvoiceRow({ invoice, locale = "en" }) {
  const router = useRouter();
  const t = (key, vars) => translate(locale, key, vars);
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
      toast.error((await res.json()).error || t("invoice.toastError"));
      return;
    }
    toast(t("invoice.toastSubmitted"));
    setDisputing(false);
    router.refresh();
  }

  const statusLabel = {
    Paid: t("invoice.statusPaid"),
    Unpaid: t("invoice.statusUnpaid"),
    Overdue: t("invoice.statusOverdue"),
    Disputed: t("invoice.statusDisputed"),
  }[invoice.status] || invoice.status;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 text-sm">
        <span className="font-data font-semibold text-ink">{invoice.invoice_number}</span>
        <span className="text-ink-soft">{invoice.project_title}</span>
        <span className="font-data text-xs text-ink-muted">
          {t("invoice.issued", { date: formatDate(locale, invoice.issued_date, { month: "short", day: "numeric" }) })}
          {" · "}
          <span className={invoice.status === "Overdue" ? "font-semibold text-danger" : ""}>
            {t("invoice.due", { date: formatDate(locale, invoice.due_date, { month: "short", day: "numeric" }) })}
          </span>
        </span>
        <Money amount={invoice.amount} currency={invoice.currency} locale={locale} className="font-data ml-auto font-medium text-ink" />
        <span className={`font-data w-20 text-right text-xs font-semibold ${STATUS_STYLE[invoice.status] || ""}`}>
          {statusLabel}
        </span>
        <div className="flex items-center gap-3">
          {(invoice.status === "Unpaid" || invoice.status === "Overdue") && (
            <button
              onClick={() => setDisputing(true)}
              className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-dispute"
              title={t("invoice.disputeTitle")}
            >
              <ShieldQuestion size={13} /> {t("invoice.dispute")}
            </button>
          )}
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Download size={13} /> {t("invoice.pdf")}
          </a>
        </div>
      </div>
      {invoice.status === "Disputed" && invoice.dispute_reason && (
        <p className="bg-dispute/5 px-4 pb-3 text-xs text-dispute">
          {t("invoice.underDispute", { reason: invoice.dispute_reason })}
        </p>
      )}
      {disputing && (
        <div className="bg-bg-primary/40 px-4 pb-4">
          <p className="text-sm text-ink-soft">
            {t("invoice.disputePrompt", { number: invoice.invoice_number })}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t("invoice.disputePlaceholder")}
            className="mt-2 w-full rounded-lg border border-line bg-bg-tertiary p-2 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy || !reason.trim()}
              onClick={submitDispute}
              className="rounded-lg bg-dispute px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? t("invoice.submitting") : t("invoice.submitDispute")}
            </button>
            <button onClick={() => setDisputing(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
