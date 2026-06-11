import { requireOperator, redirectBack } from "@/lib/admin";
import { setSetting, INVOICE_SETTING_KEYS } from "@/lib/settings";

// Invoice branding: business identity printed on every invoice PDF.
export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  for (const key of INVOICE_SETTING_KEYS) {
    await setSetting(key, String(form.get(key) || "").trim());
  }
  return redirectBack(request, form);
}
