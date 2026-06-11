import { requireOperator, redirectBack } from "@/lib/admin";
import { setSetting } from "@/lib/settings";

// Marks the operator notification feed as read up to now.
export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  await setSetting("operator_seen_activity_at", new Date().toISOString());
  return redirectBack(request, form);
}
