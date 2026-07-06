import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

// Cancel a booking, at any stage of the negotiation (pending or confirmed).
// Reschedule = cancel + book a new slot client-side.
export async function DELETE(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview. Actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { reason } = await request.json().catch(() => ({}));
  if (!reason?.trim()) {
    return NextResponse.json({ error: "A cancellation reason is required" }, { status: 400 });
  }

  const { id } = await params;
  const booking = (await sql(
    "SELECT * FROM bookings WHERE id = ? AND client_id = ? AND status IN ('pending', 'confirmed')",
    [id, client.id]
  ))[0];
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sql(
    "UPDATE bookings SET status = 'cancelled', cancelled_by = 'client', cancel_reason = ? WHERE id = ?",
    [reason.trim(), id]
  );
  await logActivity({
    clientId: client.id, actorType: "client", actorName: user.name,
    eventType: "meeting.cancelled", summary: `${user.name} cancelled "${booking.topic}" (${booking.starts_at}): ${reason.trim()}`,
  });
  await notifyOperators(
    `[${client.company_name}] Meeting cancelled`,
    `${user.name} cancelled "${booking.topic}" for ${booking.starts_at}. Reason: ${reason.trim()}`
  );
  await notifyXpm("meeting.cancelled", { booking_id: id, starts_at: booking.starts_at, reason: reason.trim() });
  return NextResponse.json({ ok: true });
}
