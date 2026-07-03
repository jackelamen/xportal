import { requireOperator, redirectBack } from "@/lib/admin";
import { setSetting, INVOICE_SETTING_KEYS, INVOICE_LOGO_KEY } from "@/lib/settings";

const LOGO_MAX_BYTES = 800_000;
const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg" };

// Invoice branding: business identity printed on every invoice PDF, plus the
// optional agency logo (stored as a base64 data URI so it survives on hosts
// with an ephemeral filesystem).
export async function POST(request) {
  const { error } = await requireOperator();
  if (error) return error;

  const form = await request.formData();
  for (const key of INVOICE_SETTING_KEYS) {
    await setSetting(key, String(form.get(key) || "").trim());
  }

  if (form.get("remove_logo")) {
    await setSetting(INVOICE_LOGO_KEY, "");
  } else {
    const logo = form.get("logo");
    if (logo && typeof logo === "object" && logo.size > 0) {
      if (!LOGO_TYPES[logo.type]) return new Response("Logo must be a PNG or JPG", { status: 400 });
      if (logo.size > LOGO_MAX_BYTES) return new Response("Logo must be under 800 KB", { status: 400 });
      const b64 = Buffer.from(await logo.arrayBuffer()).toString("base64");
      await setSetting(INVOICE_LOGO_KEY, `data:${logo.type};base64,${b64}`);
    }
    // No new file and no removal: leave the existing logo untouched.
  }

  return redirectBack(request, form);
}
