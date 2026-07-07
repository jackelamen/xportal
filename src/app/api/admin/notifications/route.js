import { requireOperator, redirectBack } from "@/lib/admin";
import { setSetting } from "@/lib/settings";

// Clears one of the operator's two dashboard activity lists by advancing its
// "cleared up to" marker to now - the underlying activity_log rows are never
// touched, they just stop appearing in that list. _action picks which list;
// a fixed lookup keeps the settings key out of client-controlled input.
const CLEAR_KEY = {
  clear_notifications: "operator_seen_activity_at",
  clear_recent: "operator_cleared_recent_activity_at",
};

export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  const key = CLEAR_KEY[form.get("_action")] || CLEAR_KEY.clear_notifications;
  await setSetting(key, new Date().toISOString());
  return redirectBack(request, form);
}
