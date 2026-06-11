import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import InvoiceRow from "@/components/InvoiceRow";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { client } = await getClientSession();
  const invoices = await sql(
    `SELECT i.*, p.title AS project_title FROM invoices i
     JOIN portal_projects p ON p.id = i.project_id
     WHERE p.client_id = ? AND p.hidden_from_client = 0 ORDER BY i.issued_date DESC`,
    [client.id]
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Billing</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full bg-bg-secondary text-sm">
          <thead className="bg-bg-tertiary text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink-muted">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
