import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";

// Payment confirmation listener. Phase 1 (no STRIPE_WEBHOOK_SECRET) accepts
// unsigned test payloads so the Unpaid -> Paid transition is testable locally.
// Phase 2 must set STRIPE_WEBHOOK_SECRET, which enforces signature checks.
export async function POST(request) {
  const raw = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (secret) {
    const sig = request.headers.get("stripe-signature") || "";
    const parts = Object.fromEntries(sig.split(",").map((kv) => kv.split("=")));
    const expected = createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
    const given = Buffer.from(parts.v1 || "", "hex");
    const want = Buffer.from(expected, "hex");
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const event = JSON.parse(raw);
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data?.object;
    const invoiceNumber = pi?.metadata?.invoice_number;
    if (invoiceNumber) {
      getDb()
        .prepare(
          "UPDATE invoices SET status = 'Paid', stripe_payment_intent_id = ? WHERE invoice_number = ?"
        )
        .run(pi.id || null, invoiceNumber);
    }
  }
  return NextResponse.json({ received: true });
}
