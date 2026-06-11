import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

// Cancel a booking (reschedule = cancel + book a new slot client-side).
export async function DELETE(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview — actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { id } = await params;
  const db = getDb();
  const booking = db
    .prepare("SELECT * FROM bookings WHERE id = ? AND client_id = ? AND status = 'confirmed'")
    .get(id, client.id);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(id);
  logActivity({
    clientId: client.id, actorType: "client", actorName: user.name,
    eventType: "meeting.cancelled", summary: `${user.name} cancelled "${booking.topic}" (${booking.starts_at})`,
  });
  await notifyOperators(
    `[${client.company_name}] Meeting cancelled`,
    `${user.name} cancelled "${booking.topic}" — ${booking.starts_at}.`
  );
  await notifyXpm("meeting.cancelled", { booking_id: id, starts_at: booking.starts_at });
  return NextResponse.json({ ok: true });
}
