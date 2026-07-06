"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CURRENCIES } from "@/lib/money";
import Money from "@/components/Money";

const blankRow = () => ({ description: "", quantity: "1", unit_price: "" });
const str = (v) => (v == null ? "" : String(v));

// Invoice composer with itemized line rows. The live total is the sum of
// quantity x rate; the rows serialize into a hidden field the API reads.
// When `invoice` is passed it edits that invoice instead of creating one.
export default function InvoiceForm({ projectId, redirectTo, inputClass, invoice, initialLineItems }) {
  const editing = !!invoice;
  const [rows, setRows] = useState(
    initialLineItems?.length
      ? initialLineItems.map((r) => ({ description: str(r.description), quantity: str(r.quantity), unit_price: str(r.unit_price) }))
      : [blankRow()]
  );
  const [currency, setCurrency] = useState(invoice?.currency || "USD");

  const setCell = (i, key, value) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (i) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, j) => j !== i)));

  const total = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0);
  const serialized = JSON.stringify(
    rows
      .filter((r) => r.description.trim() && Number(r.quantity) > 0)
      .map((r) => ({ description: r.description.trim(), quantity: Number(r.quantity), unit_price: Number(r.unit_price) || 0 }))
  );

  return (
    <form action={editing ? `/api/admin/invoices/${invoice.id}` : "/api/admin/invoices"} method="post" className="mt-3 space-y-4 text-sm">
      {editing ? <input type="hidden" name="_action" value="edit" /> : <input type="hidden" name="project_id" value={projectId} />}
      <input type="hidden" name="_redirect" value={redirectTo} />
      <input type="hidden" name="line_items" value={serialized} />
      <input type="hidden" name="currency" value={currency} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-ink-soft">Number<input name="invoice_number" required defaultValue={invoice?.invoice_number || ""} className={inputClass} /></label>
        <label className="block text-ink-soft">
          Currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-ink-soft">Issued<input name="issued_date" type="date" required defaultValue={invoice?.issued_date || ""} className={inputClass} /></label>
        <label className="block text-ink-soft">Due<input name="due_date" type="date" required defaultValue={invoice?.due_date || ""} className={inputClass} /></label>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          <span className="flex-1">Description</span>
          <span className="w-16 text-right">Qty</span>
          <span className="w-24 text-right">Rate</span>
          <span className="w-24 text-right">Amount</span>
          <span className="w-7" />
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.description}
                onChange={(e) => setCell(i, "description", e.target.value)}
                placeholder="e.g. Brand strategy workshop"
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2"
              />
              <input
                value={r.quantity}
                onChange={(e) => setCell(i, "quantity", e.target.value)}
                type="number" step="0.01" min="0"
                className="w-16 rounded-lg border border-line bg-bg-tertiary px-2 py-2 text-right text-ink outline-none focus:border-accent-2"
              />
              <input
                value={r.unit_price}
                onChange={(e) => setCell(i, "unit_price", e.target.value)}
                type="number" step="0.01" min="0" placeholder="0.00"
                className="w-24 rounded-lg border border-line bg-bg-tertiary px-2 py-2 text-right text-ink outline-none focus:border-accent-2"
              />
              <Money
                amount={(Number(r.quantity) || 0) * (Number(r.unit_price) || 0)}
                currency={currency}
                locale="en"
                className="font-data w-24 text-right text-ink-soft"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove line"
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                disabled={rows.length === 1}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-accent-2 hover:text-ink"
        >
          <Plus size={13} /> Add line
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-3">
        <span className="font-data text-[13px] font-semibold text-ink">
          Total <Money amount={total} currency={currency} locale="en" className="ml-2 text-ink-soft" />
        </span>
        <button
          disabled={total <= 0}
          className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {editing ? "Save changes" : "Create invoice"}
        </button>
      </div>
    </form>
  );
}
