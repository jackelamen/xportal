// Minimal RFC 5545 calendar file for booking confirmations.

const icsDate = (d) =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function bookingIcs({ id, starts_at, duration_minutes, topic, organizer = "xPortal" }) {
  const start = new Date(starts_at.replace(" ", "T"));
  const end = new Date(start.getTime() + duration_minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//xPortal//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${id}@xportal`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${(topic || "Project meeting").replace(/[\n,;]/g, " ")}`,
    `DESCRIPTION:Booked via ${organizer}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
