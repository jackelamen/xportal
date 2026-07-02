import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { getAvailableSlots, MEETING_LENGTHS } from "@/lib/calendar";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

export async function GET(request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const duration = Number(new URL(request.url).searchParams.get("duration")) || 30;
  const mine = await sql(
    "SELECT * FROM bookings WHERE client_id = ? AND status = 'confirmed' AND starts_at > NOW() ORDER BY starts_at ASC",
    [session.client.id]
  );
  return NextResponse.json({ slots: await getAvailableSlots(duration), bookings: mine });
}

export async function POST(request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "Read-only preview. Actions are disabled" }, { status: 403 });
  const { user, client } = session;

  const { starts_at, topic, duration_minutes } = await request.json().catch(() => ({}));
  const duration = Number(duration_minutes);
  if (!topic?.trim()) {
    return NextResponse.json({ error: "A meeting topic is required" }, { status: 400 });
  }
  if (!MEETING_LENGTHS.includes(duration)) {
    return NextResponse.json({ error: "Invalid meeting length" }, { status: 400 });
  }
  if (!(await getAvailableSlots(duration)).includes(starts_at)) {
    return NextResponse.json({ error: "Slot is no longer available" }, { status: 409 });
  }

  const id = uuid();
  await sql(
    "INSERT INTO bookings (id, client_id, client_user_id, starts_at, duration_minutes, topic) VALUES (?, ?, ?, ?, ?, ?)",
    [id, client.id, user.id, starts_at, duration, topic.trim()]
  );

  await logActivity({
    clientId: client.id, actorType: "client", actorName: user.name,
    eventType: "meeting.booked", summary: `${user.name} booked "${topic.trim()}" (${duration} min) for ${starts_at}`,
  });
  await notifyOperators(
    `[${client.company_name}] Meeting booked`,
    `${user.name} booked "${topic.trim()}" for ${starts_at}, ${duration} minutes.`
  );
  await notifyXpm("meeting.booked", { client_id: client.id, starts_at, duration_minutes: duration, topic: topic.trim() });
  return NextResponse.json({ ok: true, id, starts_at, duration_minutes: duration });
}
