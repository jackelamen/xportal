import { getDb, uuid } from "./db";
import { sendEmail } from "./mailer";

export function logActivity({ clientId, projectId = null, actorType, actorName, eventType, summary }) {
  getDb()
    .prepare(
      `INSERT INTO activity_log (id, client_id, project_id, actor_type, actor_name, event_type, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(uuid(), clientId, projectId, actorType, actorName || null, eventType, summary);
}

// Notify every contact at a client company.
export async function notifyClient(clientId, subject, text) {
  const users = getDb().prepare("SELECT name, email FROM client_users WHERE client_id = ?").all(clientId);
  await Promise.all(
    users.map((u) => sendEmail({ to: u.email, subject, text: `Hi ${u.name},\n\n${text}` }))
  );
}

// Notify the internal team.
export async function notifyOperators(subject, text) {
  const ops = getDb().prepare("SELECT name, email FROM operator_users").all();
  await Promise.all(ops.map((o) => sendEmail({ to: o.email, subject, text })));
}
