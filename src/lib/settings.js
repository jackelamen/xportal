import { getDb } from "./db";

// Operator-wide key/value settings (invoice branding, etc). Created lazily so
// adding settings never wipes the dev DB.
function ensure(db) {
  db.exec("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)");
}

export function getSettings(keys) {
  const db = getDb();
  ensure(db);
  const rows = db
    .prepare(`SELECT key, value FROM app_settings WHERE key IN (${keys.map(() => "?").join(",")})`)
    .all(...keys);
  const out = Object.fromEntries(keys.map((k) => [k, ""]));
  for (const r of rows) out[r.key] = r.value || "";
  return out;
}

export function setSetting(key, value) {
  const db = getDb();
  ensure(db);
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export const INVOICE_SETTING_KEYS = [
  "invoice_business_name",
  "invoice_business_address",
  "invoice_payment_instructions",
  "invoice_footer",
];
