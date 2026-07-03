import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// A designed, branded invoice PDF (replaces the old text-only writer):
// an accent header band, business identity, billed-to block, an itemized
// line-item table, a totals box, and an optional payment-instructions panel.

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const RIGHT = PAGE_W - MARGIN;

function hexToRgb(hex, fallback = [0.357, 0.282, 0.933]) {
  const m = /^#?([a-f\d]{6})$/i.exec((hex || "").trim());
  if (!m) return rgb(...fallback);
  const int = parseInt(m[1], 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

const INK = rgb(0.086, 0.086, 0.114);
const SOFT = rgb(0.302, 0.302, 0.35);
const MUTED = rgb(0.43, 0.43, 0.48);
const LINE = rgb(0.898, 0.898, 0.933);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export async function buildInvoicePdf({ inv, client, lineItems = [], settings = {} }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(client.accent_color);

  const text = (s, x, y, { size = 10, f = font, color = INK } = {}) =>
    page.drawText(String(s ?? ""), { x, y, size, font: f, color });
  const rightText = (s, xRight, y, { size = 10, f = font, color = INK } = {}) => {
    const str = String(s ?? "");
    page.drawText(str, { x: xRight - f.widthOfTextAtSize(str, size), y, size, font: f, color });
  };
  // Truncate to fit a max width, appending an ellipsis.
  const fit = (s, maxW, size, f = font) => {
    let str = String(s ?? "");
    if (f.widthOfTextAtSize(str, size) <= maxW) return str;
    while (str.length > 1 && f.widthOfTextAtSize(str + "…", size) > maxW) str = str.slice(0, -1);
    return str + "…";
  };

  // Accent band across the very top.
  page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: accent });

  let y = PAGE_H - 92;

  // Header: business identity (left) + INVOICE label (right).
  const businessName = settings.invoice_business_name || "Invoice";
  text(businessName, MARGIN, y, { size: 19, f: bold });
  rightText("INVOICE", RIGHT, y + 4, { size: 22, f: bold, color: accent });
  rightText(`#${inv.invoice_number}`, RIGHT, y - 12, { size: 10, f: bold, color: SOFT });

  if (settings.invoice_business_address) {
    let ay = y - 16;
    for (const ln of settings.invoice_business_address.split("\n").slice(0, 4)) {
      text(ln, MARGIN, ay, { size: 9, color: MUTED });
      ay -= 12;
    }
  }

  y -= 74;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });

  // Billed-to (left) + dates/status (right).
  y -= 26;
  text("BILLED TO", MARGIN, y, { size: 8, f: bold, color: MUTED });
  text(client.company_name, MARGIN, y - 16, { size: 12, f: bold });
  text(client.primary_email || "", MARGIN, y - 30, { size: 9.5, color: SOFT });

  const metaX = 360;
  const metaRow = (label, value, yy, valueColor = INK) => {
    text(label, metaX, yy, { size: 8, f: bold, color: MUTED });
    rightText(value, RIGHT, yy, { size: 10, f: bold, color: valueColor });
  };
  const statusColor =
    inv.status === "Paid" ? rgb(0.02, 0.588, 0.412)
    : inv.status === "Disputed" ? rgb(0.494, 0.133, 0.808)
    : inv.status === "Overdue" ? rgb(0.745, 0.071, 0.235)
    : rgb(0.706, 0.325, 0.035);
  metaRow("ISSUED", inv.issued_date, y);
  metaRow("DUE", inv.due_date, y - 16);
  metaRow("STATUS", (inv.status || "").toUpperCase(), y - 32, statusColor);

  // Line-item table.
  y -= 66;
  const QTY_R = 396;
  const RATE_R = 476;
  const descMax = QTY_R - MARGIN - 70;

  // Header row on a tinted band.
  page.drawRectangle({ x: MARGIN, y: y - 6, width: RIGHT - MARGIN, height: 22, color: rgb(0.965, 0.965, 0.98) });
  const hy = y;
  text("DESCRIPTION", MARGIN + 8, hy, { size: 8, f: bold, color: MUTED });
  rightText("QTY", QTY_R, hy, { size: 8, f: bold, color: MUTED });
  rightText("RATE", RATE_R, hy, { size: 8, f: bold, color: MUTED });
  rightText("AMOUNT", RIGHT - 8, hy, { size: 8, f: bold, color: MUTED });

  y -= 24;
  const rows = lineItems.length
    ? lineItems
    : [{ description: inv.project_title || "Services", quantity: 1, unit_price: inv.amount }];
  for (const r of rows) {
    const amt = Number(r.quantity) * Number(r.unit_price);
    text(fit(r.description, descMax, 10), MARGIN + 8, y, { size: 10, color: INK });
    rightText(String(r.quantity), QTY_R, y, { size: 10, color: SOFT });
    rightText(money(r.unit_price), RATE_R, y, { size: 10, color: SOFT });
    rightText(money(amt), RIGHT - 8, y, { size: 10, color: INK });
    y -= 16;
    page.drawLine({ start: { x: MARGIN, y: y + 5 }, end: { x: RIGHT, y: y + 5 }, thickness: 0.5, color: LINE });
    y -= 4;
  }

  // Totals box (right-aligned).
  y -= 14;
  const boxW = 220;
  const boxX = RIGHT - boxW;
  page.drawRectangle({ x: boxX, y: y - 20, width: boxW, height: 34, color: accent, opacity: 0.06 });
  page.drawLine({ start: { x: boxX, y: y + 14 }, end: { x: boxX, y: y - 20 }, thickness: 2, color: accent });
  text("TOTAL DUE", boxX + 14, y, { size: 9, f: bold, color: SOFT });
  rightText(money(inv.amount), RIGHT - 12, y - 3, { size: 16, f: bold, color: INK });

  y -= 56;

  // Dispute note.
  if (inv.status === "Disputed" && inv.dispute_reason) {
    text("UNDER DISPUTE", MARGIN, y, { size: 8, f: bold, color: statusColor });
    text(fit(inv.dispute_reason, RIGHT - MARGIN, 9.5), MARGIN, y - 14, { size: 9.5, color: SOFT });
    y -= 40;
  }

  // Payment instructions panel.
  if (settings.invoice_payment_instructions) {
    const lines = settings.invoice_payment_instructions.split("\n").slice(0, 6);
    const panelH = 26 + lines.length * 13;
    page.drawRectangle({ x: MARGIN, y: y - panelH + 14, width: RIGHT - MARGIN, height: panelH, color: rgb(0.965, 0.965, 0.98) });
    text("PAYMENT INSTRUCTIONS", MARGIN + 12, y, { size: 8, f: bold, color: MUTED });
    let py = y - 16;
    for (const ln of lines) {
      text(fit(ln, RIGHT - MARGIN - 24, 9.5), MARGIN + 12, py, { size: 9.5, color: SOFT });
      py -= 13;
    }
    y = y - panelH;
  }

  // Footer.
  if (settings.invoice_footer) {
    page.drawLine({ start: { x: MARGIN, y: 64 }, end: { x: RIGHT, y: 64 }, thickness: 0.5, color: LINE });
    let fy = 50;
    for (const ln of settings.invoice_footer.split("\n").slice(0, 3)) {
      text(fit(ln, RIGHT - MARGIN, 8.5), MARGIN, fy, { size: 8.5, color: MUTED });
      fy -= 11;
    }
  }

  return Buffer.from(await doc.save());
}
