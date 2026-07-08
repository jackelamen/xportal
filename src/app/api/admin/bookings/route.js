import { sql } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect } from "@/lib/admin";
import { getAvailableSlots, MEETING_LENGTHS } from "@/lib/calendar";
import { logActivity, notifyClient } from "@/lib/activity";
import { notifyXpm } from "@/lib/xpm-bridge";

// Operator response to a meeting request/counter. _action:
//   accept  - confirm the client's current proposal as-is
//   counter - propose a different time, handing the turn back to the client
//   cancel  - end the negotiation (or a confirmed meeting) with a reason
export async function POST(request) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const action = form.get("_action");
  const id = String(form.get("booking_id") || "");
  const str = (k) => String(form.get(k) || "").trim();

  const booking = (await sql("SELECT * FROM bookings WHERE id = ?", [id]))[0];
  if (!booking) return errorRedirect(request, form, "Not found");

  if (action === "accept") {
    if (!(booking.status === "pending" && booking.proposed_by === "client")) {
      return errorRedirect(request, form, "Not awaiting your response");
    }
    await sql(
      "UPDATE bookings SET status = 'confirmed' WHERE id = ? AND status = 'pending' AND proposed_by = 'client'",
      [id]
    );
    await logActivity({
      clientId: booking.client_id, actorType: "operator", actorName: operator.name,
      eventType: "meeting.confirmed", summary: `${operator.name} accepted the meeting for ${booking.starts_at}`,
    });
    await notifyClient(
      booking.client_id, "Meeting confirmed",
      `Your meeting "${booking.topic}" is confirmed for ${booking.starts_at}.`
    );
    await notifyXpm("meeting.confirmed", { booking_id: id, starts_at: booking.starts_at });
  } else if (action === "counter") {
    if (!(booking.status === "pending" && booking.proposed_by === "client")) {
      return errorRedirect(request, form, "Not awaiting your response");
    }
    const startsAt = str("starts_at");
    const duration = Number(str("duration_minutes"));
    if (!MEETING_LENGTHS.includes(duration)) {
      return errorRedirect(request, form, "Invalid meeting length");
    }
    if (!(await getAvailableSlots(duration, id)).includes(startsAt)) {
      return errorRedirect(request, form, "That slot is no longer available");
    }
    await sql(
      `UPDATE bookings SET starts_at = ?, duration_minutes = ?, proposed_by = 'operator', status = 'pending'
       WHERE id = ? AND status = 'pending' AND proposed_by = 'client'`,
      [startsAt, duration, id]
    );
    await logActivity({
      clientId: booking.client_id, actorType: "operator", actorName: operator.name,
      eventType: "meeting.countered", summary: `${operator.name} proposed a new time: ${startsAt}`,
    });
    await notifyClient(
      booking.client_id, "New meeting time proposed",
      `A different time was proposed for "${booking.topic}": ${startsAt}, ${duration} minutes.`
    );
    await notifyXpm("meeting.countered", { booking_id: id, starts_at: startsAt, duration_minutes: duration });
  } else if (action === "cancel") {
    if (!["pending", "confirmed"].includes(booking.status)) {
      return errorRedirect(request, form, "Already cancelled");
    }
    const reason = str("reason");
    if (!reason) return errorRedirect(request, form, "A cancellation reason is required");
    await sql(
      `UPDATE bookings SET status = 'cancelled', cancelled_by = 'operator', cancel_reason = ?
       WHERE id = ? AND status IN ('pending', 'confirmed')`,
      [reason, id]
    );
    await logActivity({
      clientId: booking.client_id, actorType: "operator", actorName: operator.name,
      eventType: "meeting.cancelled", summary: `${operator.name} cancelled "${booking.topic}" (${booking.starts_at}): ${reason}`,
    });
    await notifyClient(
      booking.client_id, "Meeting cancelled",
      `"${booking.topic}" for ${booking.starts_at} was cancelled. Reason: ${reason}`
    );
    await notifyXpm("meeting.cancelled", { booking_id: id, starts_at: booking.starts_at, reason });
  } else {
    return errorRedirect(request, form, "Unknown action");
  }

  return redirectBack(request, form);
}
