import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { bookingIcs } from "@/lib/ics";

export async function GET(request, { params }) {
  const session = await getClientSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const booking = (await sql("SELECT * FROM bookings WHERE id = ? AND client_id = ?", [id, session.client.id]))[0];
  if (!booking) return new Response("Not found", { status: 404 });

  const startsAt = booking.starts_at instanceof Date
    ? booking.starts_at.toISOString().replace("T", " ").slice(0, 19)
    : String(booking.starts_at);

  return new Response(bookingIcs({ ...booking, starts_at: startsAt }), {
    headers: {
      "Content-Type": "text/calendar",
      "Content-Disposition": `attachment; filename="meeting-${startsAt.slice(0, 10)}.ics"`,
    },
  });
}
