import { getDb } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { bookingIcs } from "@/lib/ics";

export async function GET(request, { params }) {
  const session = await getClientSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const booking = getDb()
    .prepare("SELECT * FROM bookings WHERE id = ? AND client_id = ?")
    .get(id, session.client.id);
  if (!booking) return new Response("Not found", { status: 404 });

  return new Response(bookingIcs(booking), {
    headers: {
      "Content-Type": "text/calendar",
      "Content-Disposition": `attachment; filename="meeting-${booking.starts_at.slice(0, 10)}.ics"`,
    },
  });
}
