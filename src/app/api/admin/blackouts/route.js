import { sql } from "@/lib/db";
import { requireOperator, redirectBack, errorRedirect } from "@/lib/admin";
import { addBlackout } from "@/lib/calendar";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Operator availability. _action:
//   add        - block a date, whole-day or a time range
//   delete     - remove a block
//   set_hours  - save the default weekly bookable window (Calendly-style)
export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const action = form.get("_action");
  const str = (k) => String(form.get(k) || "").trim();

  if (action === "add") {
    const date = str("on_date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorRedirect(request, form, "A date is required");
    }
    const startTime = TIME_RE.test(str("start_time")) ? str("start_time") : null;
    const endTime = TIME_RE.test(str("end_time")) ? str("end_time") : null;
    if (startTime && endTime && startTime >= endTime) {
      return errorRedirect(request, form, "End time must be after start time");
    }
    await addBlackout({ date, startTime, endTime, note: str("note") || null });
  } else if (action === "delete") {
    await sql("DELETE FROM blackout_dates WHERE id = ?", [str("blackout_id")]);
  } else if (action === "set_hours") {
    for (let d = 0; d < 7; d++) {
      const enabled = form.get(`enabled_${d}`) ? 1 : 0;
      const start = TIME_RE.test(str(`start_${d}`)) ? str(`start_${d}`) : "09:00";
      const end = TIME_RE.test(str(`end_${d}`)) ? str(`end_${d}`) : "17:00";
      if (enabled && start >= end) {
        return errorRedirect(request, form, `End time must be after start time (${DAY_NAMES[d]})`);
      }
      await sql(
        "UPDATE weekly_hours SET enabled = ?, start_time = ?, end_time = ? WHERE weekday = ?",
        [enabled, start, end, d]
      );
    }
  } else {
    return errorRedirect(request, form, "Unknown action");
  }
  return redirectBack(request, form);
}
