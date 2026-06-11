import { sql, uuid } from "./db";

export const MEETING_LENGTHS = [15, 30, 45, 60];
const STEP_MIN = 30;
const DAYS_AHEAD = 14;

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const toMin = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

export async function getWeeklyHours() {
  return sql("SELECT * FROM weekly_hours ORDER BY weekday");
}

export async function getBlackoutDates() {
  return sql("SELECT * FROM blackout_dates WHERE on_date >= CURRENT_DATE ORDER BY on_date, start_time");
}

export async function addBlackout({ date, startTime, endTime, note }) {
  await sql(
    "INSERT INTO blackout_dates (id, on_date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?)",
    [uuid(), date, startTime || null, endTime || null, note || null]
  );
}

export async function getAvailableSlots(durationMinutes = 30) {
  if (!MEETING_LENGTHS.includes(durationMinutes)) return [];

  const hoursRows = await getWeeklyHours();
  const hours = Object.fromEntries(hoursRows.map((h) => [h.weekday, h]));

  const allBlackouts = await sql("SELECT * FROM blackout_dates");
  const blackouts = {};
  for (const b of allBlackouts) {
    (blackouts[b.on_date] ||= []).push(b);
  }

  const busyRows = await sql(
    `SELECT starts_at, duration_minutes FROM bookings
     WHERE status = 'confirmed' AND starts_at > (NOW() - INTERVAL '1 day')`
  );
  const busy = busyRows.map((b) => {
    const start = new Date(b.starts_at);
    return [start.getTime(), start.getTime() + b.duration_minutes * 60_000];
  });
  const overlapsBooking = (s, e) => busy.some(([bs, be]) => s < be && bs < e);

  const slots = [];
  const day = new Date();
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    day.setDate(day.getDate() + 1);
    const rule = hours[day.getDay()];
    if (!rule?.enabled) continue;

    const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const dayBlackouts = blackouts[dateStr] || [];
    if (dayBlackouts.some((b) => !b.start_time && !b.end_time)) continue;
    const blockedRanges = dayBlackouts.map((b) => [
      toMin(b.start_time) ?? 0,
      toMin(b.end_time) ?? 24 * 60,
    ]);

    const startMin = toMin(rule.start_time) ?? 540;
    const endMin = toMin(rule.end_time) ?? 1020;
    for (let m = startMin; m + durationMinutes <= endMin; m += STEP_MIN) {
      if (blockedRanges.some(([bs, be]) => m < be && bs < m + durationMinutes)) continue;
      const start = new Date(day);
      start.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const s = start.getTime();
      if (!overlapsBooking(s, s + durationMinutes * 60_000)) slots.push(fmt(start));
    }
  }
  return slots;
}
