import { getDb, uuid } from "./db";

// Availability provider, Calendly-style:
//   - weekly_hours: per-weekday default bookable window (seeded M-F 9-5)
//   - blackout_dates: specific unavailable dates, whole-day or a time range
// Phase 1 generates slots locally with confirmed bookings as the busy source;
// Phase 2 swaps in a Google Calendar freebusy query behind the same signature.

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

// Tables are created lazily so adding availability features never wipes the
// dev DB; both also live in SCHEMA for fresh creates.
export function ensureAvailability(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS blackout_dates (
       id TEXT PRIMARY KEY,
       on_date TEXT NOT NULL,
       start_time TEXT,
       end_time TEXT,
       note TEXT,
       created_at TEXT DEFAULT (datetime('now'))
     )`
  );
  const cols = db.prepare("PRAGMA table_info(blackout_dates)").all().map((c) => c.name);
  if (!cols.includes("start_time")) db.exec("ALTER TABLE blackout_dates ADD COLUMN start_time TEXT");
  if (!cols.includes("end_time")) db.exec("ALTER TABLE blackout_dates ADD COLUMN end_time TEXT");

  db.exec(
    `CREATE TABLE IF NOT EXISTS weekly_hours (
       weekday INTEGER PRIMARY KEY,  -- 0 = Sunday … 6 = Saturday
       enabled INTEGER NOT NULL DEFAULT 0,
       start_time TEXT NOT NULL DEFAULT '09:00',
       end_time TEXT NOT NULL DEFAULT '17:00'
     )`
  );
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM weekly_hours").get();
  if (n === 0) {
    const ins = db.prepare("INSERT INTO weekly_hours (weekday, enabled) VALUES (?, ?)");
    for (let d = 0; d < 7; d++) ins.run(d, d >= 1 && d <= 5 ? 1 : 0);
  }
}

export function getWeeklyHours() {
  const db = getDb();
  ensureAvailability(db);
  return db.prepare("SELECT * FROM weekly_hours ORDER BY weekday").all();
}

export function getBlackoutDates() {
  const db = getDb();
  ensureAvailability(db);
  return db
    .prepare("SELECT * FROM blackout_dates WHERE on_date >= date('now') ORDER BY on_date, start_time")
    .all();
}

export function addBlackout({ date, startTime, endTime, note }) {
  const db = getDb();
  ensureAvailability(db);
  db.prepare(
    "INSERT INTO blackout_dates (id, on_date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?)"
  ).run(uuid(), date, startTime || null, endTime || null, note || null);
}

export function getAvailableSlots(durationMinutes = 30) {
  if (!MEETING_LENGTHS.includes(durationMinutes)) return [];
  const db = getDb();
  ensureAvailability(db);

  const hours = Object.fromEntries(getWeeklyHours().map((h) => [h.weekday, h]));

  const blackouts = {};
  for (const b of db.prepare("SELECT * FROM blackout_dates").all()) {
    (blackouts[b.on_date] ||= []).push(b);
  }

  const busy = db
    .prepare(
      `SELECT starts_at, duration_minutes FROM bookings
       WHERE status = 'confirmed' AND starts_at > datetime('now', '-1 day')`
    )
    .all()
    .map((b) => {
      const start = new Date(b.starts_at.replace(" ", "T"));
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
    // A blackout without times blocks the whole day.
    if (dayBlackouts.some((b) => !b.start_time && !b.end_time)) continue;
    // Timed blackouts block their range (open-ended ranges block to the edge of the day).
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
