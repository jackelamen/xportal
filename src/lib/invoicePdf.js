import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatMoneyParts } from "./money";

// English/USD invoices use built-in Helvetica (no embed, tiny file). Invoices
// that carry Korean text or a KRW amount additionally embed Noto Sans KR
// (pre-subset to Latin + Hangul + currency, ~1.8 MB per weight) which covers
// Hangul and the ₩ sign - but only text that actually needs those glyphs is
// drawn with it. The embedded NotoSansKR-Regular.otf has a glyph-advance bug
// via pdf-lib/fontkit that spaces plain ASCII text out oddly (visible on
// emails, invoice numbers, dates); Helvetica doesn't have that bug, so every
// pure-ASCII string still renders in Helvetica even on a KRW/Korean invoice.
const FONT_DIR = path.join(process.cwd(), "src/lib/fonts");
let notoCache;
function notoBytes() {
  if (!notoCache) {
    notoCache = {
      regular: fs.readFileSync(path.join(FONT_DIR, "NotoSansKR-Regular.otf")),
      bold: fs.readFileSync(path.join(FONT_DIR, "NotoSansKR-Bold.otf")),
    };
  }
  return notoCache;
}

// Helvetica (WinAnsi) can't encode codepoints above Latin-1 (e.g. Hangul) or
// the ₩ sign.
const isAscii = (s) => [...String(s ?? "")].every((ch) => ch.codePointAt(0) <= 0xff);

function needsUnicodeFont({ inv, client, lineItems, settings }) {
  if (inv.currency === "KRW") return true;
  const strings = [
    client.company_name, client.primary_email, inv.project_title, inv.dispute_reason,
    settings.invoice_business_name, settings.invoice_business_address,
    settings.invoice_payment_instructions, settings.invoice_footer,
    ...lineItems.map((r) => r.description),
  ];
  return strings.some((s) => s && !isAscii(s));
}

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

// Embeds a base64 data-URI logo (PNG or JPG) into the document, returning the
// pdf-lib image or null when absent/unsupported.
async function embedLogo(doc, dataUri) {
  const m = /^data:(image\/png|image\/jpeg);base64,(.+)$/s.exec(dataUri || "");
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  try {
    return m[1] === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function buildInvoicePdf({ inv, client, lineItems = [], settings = {}, logo }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let uni = null;
  let uniBold = null;
  if (needsUnicodeFont({ inv, client, lineItems, settings })) {
    doc.registerFontkit(fontkit);
    const noto = notoBytes();
    // subset:false: pdf-lib's subsetter corrupts CFF/OTF glyphs, and the source
    // is already pre-subset, so the embed stays small (~1.9 MB PDF).
    uni = await doc.embedFont(noto.regular, { subset: false });
    uniBold = await doc.embedFont(noto.bold, { subset: false });
  }
  // Picks Helvetica for pure-ASCII strings (sidesteps the Noto regular-weight
  // spacing bug) and only reaches for the Unicode embed when a string
  // actually contains Hangul or a non-Latin1 symbol.
  const pick = (s, isBold) => {
    if (!uni || isAscii(s)) return isBold ? helvBold : helv;
    return isBold ? uniBold : uni;
  };

  const accent = hexToRgb(client.accent_color);
  const logoImg = await embedLogo(doc, logo);

  const text = (s, x, y, { size = 10, bold = false, color = INK } = {}) =>
    page.drawText(String(s ?? ""), { x, y, size, font: pick(s, bold), color });
  const rightText = (s, xRight, y, { size = 10, bold = false, color = INK } = {}) => {
    const str = String(s ?? "");
    const f = pick(str, bold);
    page.drawText(str, { x: xRight - f.widthOfTextAtSize(str, size), y, size, font: f, color });
  };
  // Draws a currency amount right-aligned to xRight, with the symbol slightly
  // smaller and muted - keeps the ₩ sign (which forces the Noto embed) from
  // ever sizing/spacing against the figure the way a single mixed-font run
  // would, matching the same fix applied to the web app's amount displays.
  const rightMoney = (amount, currency, xRight, y, { size = 10, bold = false, color = INK } = {}) => {
    const { symbol, number } = formatMoneyParts(amount, currency, "en");
    const numFont = isAscii(number) ? (bold ? helvBold : helv) : pick(number, bold);
    const numX = xRight - numFont.widthOfTextAtSize(number, size);
    page.drawText(number, { x: numX, y, size, font: numFont, color });
    if (symbol) {
      const symSize = size * 0.75;
      const symFont = pick(symbol, bold);
      const symW = symFont.widthOfTextAtSize(symbol, symSize);
      page.drawText(symbol, { x: numX - symW - 1, y: y + (size - symSize) * 0.15, size: symSize, font: symFont, color: MUTED });
    }
  };
  // Truncate to fit a max width, appending an ellipsis.
  const fit = (s, maxW, size, isBold = false) => {
    let str = String(s ?? "");
    const f = pick(str, isBold);
    if (f.widthOfTextAtSize(str, size) <= maxW) return str;
    while (str.length > 1 && f.widthOfTextAtSize(str + "…", size) > maxW) str = str.slice(0, -1);
    return str + "…";
  };

  // Accent band across the very top.
  page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: accent });

  let y = PAGE_H - 92;

  // Header right: the INVOICE label + number (constant regardless of logo).
  rightText("INVOICE", RIGHT, y + 4, { size: 22, bold: true, color: accent });
  rightText(`#${inv.invoice_number}`, RIGHT, y - 12, { size: 10, bold: true, color: SOFT });

  // Header left: the agency logo when set, otherwise the business name large.
  // With a logo, the business name sits smaller beneath it.
  const businessName = settings.invoice_business_name || "Invoice";
  let addrY;
  if (logoImg) {
    const maxH = 38;
    const maxW = 220;
    const scale = Math.min(maxH / logoImg.height, maxW / logoImg.width);
    const w = logoImg.width * scale;
    const h = logoImg.height * scale;
    page.drawImage(logoImg, { x: MARGIN, y: y + 8 - h, width: w, height: h });
    if (settings.invoice_business_name) {
      text(businessName, MARGIN, y - h + 2, { size: 10.5, bold: true, color: SOFT });
      addrY = y - h - 12;
    } else {
      addrY = y - h - 2;
    }
  } else {
    text(businessName, MARGIN, y, { size: 19, bold: true });
    addrY = y - 16;
  }

  if (settings.invoice_business_address) {
    for (const ln of settings.invoice_business_address.split("\n").slice(0, 4)) {
      text(ln, MARGIN, addrY, { size: 9, color: MUTED });
      addrY -= 12;
    }
  }

  y -= 74;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });

  // Billed-to (left) + dates/status (right).
  y -= 26;
  text("BILLED TO", MARGIN, y, { size: 8, bold: true, color: MUTED });
  text(client.company_name, MARGIN, y - 16, { size: 12, bold: true });
  text(client.primary_email || "", MARGIN, y - 30, { size: 9.5, color: SOFT });

  const metaX = 360;
  const metaRow = (label, value, yy, valueColor = INK) => {
    text(label, metaX, yy, { size: 8, bold: true, color: MUTED });
    rightText(value, RIGHT, yy, { size: 10, bold: true, color: valueColor });
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
  text("DESCRIPTION", MARGIN + 8, hy, { size: 8, bold: true, color: MUTED });
  rightText("QTY", QTY_R, hy, { size: 8, bold: true, color: MUTED });
  rightText("RATE", RATE_R, hy, { size: 8, bold: true, color: MUTED });
  rightText("AMOUNT", RIGHT - 8, hy, { size: 8, bold: true, color: MUTED });

  y -= 24;
  const rows = lineItems.length
    ? lineItems
    : [{ description: inv.project_title || "Services", quantity: 1, unit_price: inv.amount }];
  for (const r of rows) {
    const amt = Number(r.quantity) * Number(r.unit_price);
    text(fit(r.description, descMax, 10), MARGIN + 8, y, { size: 10, color: INK });
    rightText(String(r.quantity), QTY_R, y, { size: 10, color: SOFT });
    rightMoney(r.unit_price, inv.currency, RATE_R, y, { size: 10, color: SOFT });
    rightMoney(amt, inv.currency, RIGHT - 8, y, { size: 10, color: INK });
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
  text("TOTAL DUE", boxX + 14, y, { size: 9, bold: true, color: SOFT });
  rightMoney(inv.amount, inv.currency, RIGHT - 12, y - 3, { size: 16, bold: true, color: INK });

  y -= 56;

  // Dispute note.
  if (inv.status === "Disputed" && inv.dispute_reason) {
    text("UNDER DISPUTE", MARGIN, y, { size: 8, bold: true, color: statusColor });
    text(fit(inv.dispute_reason, RIGHT - MARGIN, 9.5), MARGIN, y - 14, { size: 9.5, color: SOFT });
    y -= 40;
  }

  // Payment instructions panel.
  if (settings.invoice_payment_instructions) {
    const lines = settings.invoice_payment_instructions.split("\n").slice(0, 6);
    const panelH = 26 + lines.length * 13;
    page.drawRectangle({ x: MARGIN, y: y - panelH + 14, width: RIGHT - MARGIN, height: panelH, color: rgb(0.965, 0.965, 0.98) });
    text("PAYMENT INSTRUCTIONS", MARGIN + 12, y, { size: 8, bold: true, color: MUTED });
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
