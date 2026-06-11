import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, uuid } from "./db";

// Two parallel session tracks share the same tables, discriminated by
// user_type: 'client' -> client_users, 'operator' -> operator_users.
const COOKIE = { client: "xportal_session", operator: "xportal_admin" };
const LINK_TTL_MIN = 15;
const SESSION_TTL_DAYS = 60;

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const iso = (d) => d.toISOString().replace("T", " ").slice(0, 19);

export function findUserByEmail(userType, email) {
  const table = userType === "operator" ? "operator_users" : "client_users";
  return getDb()
    .prepare(`SELECT * FROM ${table} WHERE email = ?`)
    .get(email.trim().toLowerCase()) || null;
}

export function createLoginToken(userType, userId) {
  const raw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + LINK_TTL_MIN * 60_000);
  getDb()
    .prepare("INSERT INTO login_tokens (id, user_type, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(uuid(), userType, userId, sha256(raw), iso(expires));
  return raw;
}

// Consumes a magic-link token; returns { userType, sessionRaw } or null.
export function redeemLoginToken(raw) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM login_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now')`
    )
    .get(sha256(raw));
  if (!row) return null;
  db.prepare("UPDATE login_tokens SET consumed_at = datetime('now') WHERE id = ?").run(row.id);

  const sessionRaw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  db.prepare(
    "INSERT INTO active_sessions (id, user_type, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).run(uuid(), row.user_type, row.user_id, sha256(sessionRaw), iso(expires));
  return { userType: row.user_type, sessionRaw };
}

export async function setSessionCookie(userType, sessionRaw) {
  (await cookies()).set(COOKIE[userType], sessionRaw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

// Client portal session: returns { user, client } or null. `client` carries
// branding (slug, logo_path, accent_color); `user` is the individual contact.
// Operators with the xportal_preview cookie get a read-only impersonated
// session ({ preview: true }); mutating client APIs must reject it.
export async function getClientSession() {
  const store = await cookies();

  const previewClientId = store.get("xportal_preview")?.value;
  if (previewClientId) {
    const operator = await getOperatorSession();
    if (operator) {
      const db = getDb();
      const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(previewClientId);
      const contact = client
        ? db.prepare("SELECT * FROM client_users WHERE client_id = ? ORDER BY created_at LIMIT 1").get(previewClientId)
        : null;
      if (client && contact) {
        return {
          user: { id: contact.id, name: contact.name, email: contact.email },
          client,
          preview: true,
        };
      }
    }
  }

  const raw = store.get(COOKIE.client)?.value;
  if (!raw) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email, c.*
       FROM active_sessions s
       JOIN client_users u ON u.id = s.user_id
       JOIN clients c ON c.id = u.client_id
       WHERE s.user_type = 'client' AND s.token_hash = ? AND s.expires_at > datetime('now')`
    )
    .get(sha256(raw));
  if (!row) return null;
  const { user_id, user_name, user_email, ...client } = row;
  return { user: { id: user_id, name: user_name, email: user_email }, client };
}

// Operator session: returns the operator_users row or null.
export async function getOperatorSession() {
  const raw = (await cookies()).get(COOKIE.operator)?.value;
  if (!raw) return null;
  return (
    getDb()
      .prepare(
        `SELECT u.* FROM active_sessions s JOIN operator_users u ON u.id = s.user_id
         WHERE s.user_type = 'operator' AND s.token_hash = ? AND s.expires_at > datetime('now')`
      )
      .get(sha256(raw)) || null
  );
}

export async function destroySession(userType) {
  const store = await cookies();
  const raw = store.get(COOKIE[userType])?.value;
  if (raw) {
    getDb().prepare("DELETE FROM active_sessions WHERE token_hash = ?").run(sha256(raw));
  }
  store.delete(COOKIE[userType]);
}
