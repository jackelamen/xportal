import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { buildInvoicePdf } from "@/lib/invoicePdf";
import { getSettings, INVOICE_SETTING_KEYS, INVOICE_LOGO_KEY } from "@/lib/settings";

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

  const lineItems = await sql(
    "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order", [id]
  );
  const settings = await getSettings([...INVOICE_SETTING_KEYS, INVOICE_LOGO_KEY]);

  const pdf = await buildInvoicePdf({ inv, client, lineItems, settings, logo: settings[INVOICE_LOGO_KEY] });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.invoice_number}.pdf"`,
    },
  });
}
