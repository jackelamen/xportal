import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql, uuid } from "./db";

const COOKIE = { client: "xportal_session", operator: "xportal_admin" };
const LINK_TTL_MIN = 15;
const SESSION_TTL_DAYS = 60;

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export async function findUserByEmail(userType, email) {
  const addr = email.trim().toLowerCase();
  if (userType === "operator") {
    return (await sql("SELECT * FROM operator_users WHERE email = $1", [addr]))[0] ?? null;
  }
  // Clients: don't resolve contacts of an archived client, so no magic link is
  // issued to a deactivated client.
  const rows = await sql(
    `SELECT u.* FROM client_users u JOIN clients c ON c.id = u.client_id
     WHERE u.email = $1 AND c.archived_at IS NULL`,
    [addr]
  );
  return rows[0] ?? null;
}

export async function createLoginToken(userType, userId) {
  const raw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + LINK_TTL_MIN * 60_000);
  await sql(
    "INSERT INTO login_tokens (id, user_type, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
    [uuid(), userType, userId, sha256(raw), expires.toISOString()]
  );
  return raw;
}

export async function redeemLoginToken(raw) {
  const rows = await sql(
    "SELECT * FROM login_tokens WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > NOW()",
    [sha256(raw)]
  );
  const row = rows[0];
  if (!row) return null;
  await sql("UPDATE login_tokens SET consumed_at = NOW() WHERE id = ?", [row.id]);
  const sessionRaw = await createSession(row.user_type, row.user_id);
  return { userType: row.user_type, sessionRaw };
}

export async function createSession(userType, userId) {
  const sessionRaw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await sql(
    "INSERT INTO active_sessions (id, user_type, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
    [uuid(), userType, userId, sha256(sessionRaw), expires.toISOString()]
  );
  return sessionRaw;
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

export async function getClientSession() {
  const store = await cookies();

  const previewClientId = store.get("xportal_preview")?.value;
  if (previewClientId) {
    const operator = await getOperatorSession();
    if (operator) {
      const clients = await sql("SELECT * FROM clients WHERE id = ?", [previewClientId]);
      const client = clients[0] ?? null;
      const contacts = client
        ? await sql("SELECT * FROM client_users WHERE client_id = ? ORDER BY created_at LIMIT 1", [previewClientId])
        : [];
      const contact = contacts[0] ?? null;
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
  const rows = await sql(
    `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email, c.*
     FROM active_sessions s
     JOIN client_users u ON u.id = s.user_id
     JOIN clients c ON c.id = u.client_id
     WHERE s.user_type = 'client' AND s.token_hash = ? AND s.expires_at > NOW()
       AND c.archived_at IS NULL`,
    [sha256(raw)]
  );
  const row = rows[0];
  if (!row) return null;
  const { user_id, user_name, user_email, ...client } = row;
  return { user: { id: user_id, name: user_name, email: user_email }, client };
}

export async function getOperatorSession() {
  const raw = (await cookies()).get(COOKIE.operator)?.value;
  if (!raw) return null;
  const rows = await sql(
    `SELECT u.* FROM active_sessions s JOIN operator_users u ON u.id = s.user_id
     WHERE s.user_type = 'operator' AND s.token_hash = ? AND s.expires_at > NOW()`,
    [sha256(raw)]
  );
  return rows[0] ?? null;
}

export async function destroySession(userType) {
  const store = await cookies();
  const raw = store.get(COOKIE[userType])?.value;
  if (raw) {
    await sql("DELETE FROM active_sessions WHERE token_hash = ?", [sha256(raw)]);
  }
  store.delete(COOKIE[userType]);
}
