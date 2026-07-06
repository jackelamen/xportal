import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { getAvailableSlots, MEETING_LENGTHS } from "@/lib/calendar";
import { notifyXpm } from "@/lib/xpm-bridge";
import { logActivity, notifyOperators } from "@/lib/activity";

export async function GET(request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const duration = Number(params.get("duration")) || 30;
  const exclude = params.get("exclude") || null;
  const mine = await sql(
    `SELECT * FROM bookings WHERE client_id = ? AND status IN ('pending', 'confirmed') AND starts_at > NOW()
     ORDER BY starts_at ASC`,
    [session.client.id]
  );
  return NextResponse.json({ slots: await getAvailableSlots(duration, exclude), bookings: mine });
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
    `INSERT INTO bookings (id, client_id, client_user_id, starts_at, duration_minutes, topic, status, proposed_by)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 'client')`,
    [id, client.id, user.id, starts_at, duration, topic.trim()]
  );

  await logActivity({
    clientId: client.id, actorType: "client", actorName: user.name,
    eventType: "meeting.requested", summary: `${user.name} requested a meeting: "${topic.trim()}" (${duration} min) for ${starts_at}`,
  });
  await notifyOperators(
    `[${client.company_name}] Meeting requested`,
    `${user.name} requested "${topic.trim()}" for ${starts_at}, ${duration} minutes.`
  );
  await notifyXpm("meeting.requested", { client_id: client.id, starts_at, duration_minutes: duration, topic: topic.trim() });
  return NextResponse.json({ ok: true, id, starts_at, duration_minutes: duration });
}
