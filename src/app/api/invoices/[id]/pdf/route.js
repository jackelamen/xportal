import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { textPdf } from "@/lib/pdf";
import { getSettings, INVOICE_SETTING_KEYS } from "@/lib/settings";

export async function GET(request, { params }) {
  const session = await getClientSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { client } = session;

  const { id } = await params;
  const inv = (await sql(
    `SELECT i.*, p.title AS project_title FROM invoices i
     JOIN portal_projects p ON p.id = i.project_id
     WHERE i.id = ? AND p.client_id = ?`,
    [id, client.id]
  ))[0];
  if (!inv) return new Response("Not found", { status: 404 });

  const s = await getSettings(INVOICE_SETTING_KEYS);
  const lines = [
    { text: s.invoice_business_name || "Invoice", size: 20, bold: true },
    ...(s.invoice_business_address
      ? s.invoice_business_address.split("\n").map((t) => ({ text: t }))
      : []),
    { text: "" },
    { text: `Invoice number: ${inv.invoice_number}`, bold: true },
    { text: `Billed to: ${client.company_name} (${client.primary_email})` },
    { text: `Project: ${inv.project_title}` },
    { text: `Issued: ${inv.issued_date}    Due: ${inv.due_date}` },
    { text: "" },
    { text: `Amount due: $${Number(inv.amount).toFixed(2)}`, size: 14, bold: true },
    { text: `Status: ${inv.status}` },
  ];
  if (inv.status === "Disputed" && inv.dispute_reason) {
    lines.push({ text: "" }, { text: `Under dispute: ${inv.dispute_reason}` });
  }
  if (s.invoice_payment_instructions) {
    lines.push({ text: "" }, { text: "Payment instructions", bold: true });
    lines.push(...s.invoice_payment_instructions.split("\n").map((t) => ({ text: t })));
  }
  if (s.invoice_footer) {
    lines.push({ text: "" }, ...s.invoice_footer.split("\n").map((t) => ({ text: t })));
  }

  return new Response(textPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.invoice_number}.pdf"`,
    },
  });
}
