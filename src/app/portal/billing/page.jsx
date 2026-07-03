import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import InvoiceRow from "@/components/InvoiceRow";
import { t, formatDate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { user, client } = await getClientSession();
  const locale = user.locale || "en";
  const invoices = await sql(
    `SELECT i.*, p.title AS project_title FROM invoices i
     JOIN portal_projects p ON p.id = i.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 ORDER BY i.issued_date DESC`,
    [client.id]
  );

  const open = invoices.filter((i) => i.status === "Unpaid" || i.status === "Overdue" || i.status === "Disputed");
  const thisYear = new Date().getFullYear();
  const paidThisYear = invoices.filter((i) => i.status === "Paid" && i.issued_date?.slice(0, 4) === String(thisYear));
  const nextDue = [...open].filter((i) => i.status !== "Disputed").sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  // Invoices can be issued in different currencies, so totals are summed per
  // currency and shown side by side rather than added into one meaningless number.
  const sumByCurrency = (list) =>
    list.reduce((acc, i) => {
      const c = i.currency || "USD";
      acc[c] = (acc[c] || 0) + Number(i.amount);
      return acc;
    }, {});
  const formatTotals = (byCurrency) => {
    const parts = Object.entries(byCurrency).filter(([, v]) => v > 0).map(([c, v]) => formatMoney(v, c, locale));
    return parts.length ? parts : [formatMoney(0, "USD", locale)];
  };
  const outstandingParts = formatTotals(sumByCurrency(open));
  const paidParts = formatTotals(sumByCurrency(paidThisYear));
  const hasOutstanding = open.length > 0;

  const Amounts = ({ parts, tone = "text-ink" }) => (
    <div className={`font-data mt-2.5 leading-none tracking-tight ${tone} ${parts.length > 1 ? "space-y-1" : ""}`}>
      {parts.map((s, i) => (
        <p key={i} className={parts.length > 1 ? "text-[1.15rem] font-medium" : "text-[1.6rem] font-medium"}>{s}</p>
      ))}
    </div>
  );

  return (
    <div className="page-enter">
      <div className="flex items-stretch gap-5 border-b border-line pb-6">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <div>
          <p className="font-data text-[11px] uppercase tracking-widest text-ink-muted">{t(locale, "billing.breadcrumb", { company: client.company_name })}</p>
          <h1 className="mt-1 text-[1.85rem] leading-none tracking-tight">{t(locale, "billing.title")}</h1>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 divide-y divide-line rounded-xl border border-line bg-bg-secondary sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className={`p-4 ${hasOutstanding ? "bg-warn/[0.04]" : ""}`}>
          <p className="text-xs font-semibold text-ink">{t(locale, "billing.outstanding")}</p>
          <Amounts parts={outstandingParts} tone={hasOutstanding ? "text-warn" : "text-ink"} />
          <p className="mt-2 text-[11.5px] text-ink-muted">{t(locale, "billing.openInvoices", { n: open.length, plural: open.length === 1 ? "" : "s" })}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-ink">{t(locale, "billing.paidThisYear")}</p>
          <Amounts parts={paidParts} />
          <p className="mt-2 text-[11.5px] text-ink-muted">{t(locale, "billing.invoicesSettled", { n: paidThisYear.length, plural: paidThisYear.length === 1 ? "" : "s" })}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-ink">{t(locale, "billing.nextDue")}</p>
          <p className="font-data mt-2.5 text-[1.6rem] font-medium leading-none tracking-tight text-ink">
            {nextDue ? formatDate(locale, nextDue.due_date, { month: "short", day: "2-digit" }) : "–"}
          </p>
          <p className="mt-2 text-[11.5px] text-ink-muted">
            {nextDue ? `${nextDue.invoice_number} · ${formatMoney(nextDue.amount, nextDue.currency, locale)}` : t(locale, "billing.nothingDue")}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-bg-secondary">
        {invoices.map((inv) => (
          <InvoiceRow key={inv.id} invoice={inv} locale={locale} />
        ))}
        {invoices.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ink-muted">{t(locale, "billing.noInvoices")}</p>
        )}
      </div>
    </div>
  );
}
