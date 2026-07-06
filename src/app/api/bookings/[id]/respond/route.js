import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { getAvailableSlots, MEETING_LENGTHS } from "@/lib/calendar";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

// Client's response to an operator's counter-proposal: accept it, or counter
// back with a different time. Only valid while it's actually the client's
// turn (status='pending' and the operator holds the current proposal).
export async function POST(request, { params }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview. Actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { id } = await params;
  const booking = (await sql(
    "SELECT * FROM bookings WHERE id = ? AND client_id = ? AND status = 'pending' AND proposed_by = 'operator'",
    [id, client.id]
  ))[0];
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action, starts_at, duration_minutes } = await request.json().catch(() => ({}));

  if (action === "accept") {
    await sql("UPDATE bookings SET status = 'confirmed' WHERE id = ?", [id]);
    await logActivity({
      clientId: client.id, actorType: "client", actorName: user.name,
      eventType: "meeting.confirmed", summary: `${user.name} accepted the meeting for ${booking.starts_at}`,
    });
    await notifyOperators(
      `[${client.company_name}] Meeting confirmed`,
      `${user.name} accepted the proposed time: ${booking.starts_at}.`
    );
    await notifyXpm("meeting.confirmed", { booking_id: id, starts_at: booking.starts_at });
    return NextResponse.json({ ok: true });
  }

  if (action === "counter") {
    const duration = Number(duration_minutes);
    if (!MEETING_LENGTHS.includes(duration)) {
      return NextResponse.json({ error: "Invalid meeting length" }, { status: 400 });
    }
    if (!(await getAvailableSlots(duration, id)).includes(starts_at)) {
      return NextResponse.json({ error: "Slot is no longer available" }, { status: 409 });
    }
    await sql(
      "UPDATE bookings SET starts_at = ?, duration_minutes = ?, proposed_by = 'client', status = 'pending' WHERE id = ?",
      [starts_at, duration, id]
    );
    await logActivity({
      clientId: client.id, actorType: "client", actorName: user.name,
      eventType: "meeting.countered", summary: `${user.name} proposed a new time: ${starts_at}`,
    });
    await notifyOperators(
      `[${client.company_name}] New meeting time proposed`,
      `${user.name} proposed a different time for "${booking.topic}": ${starts_at}, ${duration} minutes.`
    );
    await notifyXpm("meeting.countered", { booking_id: id, starts_at, duration_minutes: duration });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
