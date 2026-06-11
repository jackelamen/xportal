import { sql } from "./db";

export async function getSettings(keys) {
  const rows = await sql(
    `SELECT key, value FROM app_settings WHERE key = ANY($1::text[])`,
    [keys]
  );
  const out = Object.fromEntries(keys.map((k) => [k, ""]));
  for (const r of rows) out[r.key] = r.value || "";
  return out;
}

export async function setSetting(key, value) {
  await sql(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
    [key, value]
  );
}

export const INVOICE_SETTING_KEYS = [
  "invoice_business_name",
  "invoice_business_address",
  "invoice_payment_instructions",
  "invoice_footer",
];
