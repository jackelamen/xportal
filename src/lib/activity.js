import { sql, uuid } from "./db";
import { sendEmail } from "./mailer";

export async function logActivity({ clientId, projectId = null, actorType, actorName, eventType, summary }) {
  await sql(
    `INSERT INTO activity_log (id, client_id, project_id, actor_type, actor_name, event_type, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), clientId, projectId, actorType, actorName || null, eventType, summary]
  );
}

export async function notifyClient(clientId, subject, text) {
  const users = await sql("SELECT name, email FROM client_users WHERE client_id = ?", [clientId]);
  await Promise.all(
    users.map((u) => sendEmail({ to: u.email, subject, text: `Hi ${u.name},\n\n${text}` }))
  );
}

export async function notifyOperators(subject, text) {
  const ops = await sql("SELECT name, email FROM operator_users");
  await Promise.all(ops.map((o) => sendEmail({ to: o.email, subject, text })));
}
