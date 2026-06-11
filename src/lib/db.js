import pg, { Pool } from "pg";
import { randomUUID } from "node:crypto";

// Return date/timestamp columns as strings (like SQLite did) so existing
// .slice()-based formatting keeps working, and bigints (COUNT) as numbers.
pg.types.setTypeParser(1082, (v) => v); // date
pg.types.setTypeParser(1114, (v) => v); // timestamp
pg.types.setTypeParser(1184, (v) => v); // timestamptz
pg.types.setTypeParser(20, (v) => Number(v)); // int8 / count(*)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
});

// Convert SQLite-style ? placeholders to Postgres $1, $2, ...
// Also translate SQLite date/time functions to Postgres equivalents.
function normalize(q) {
  // Offset forms: datetime('now', '-7 days'), date('now', '+14 days')
  q = q.replace(/datetime\('now',\s*'([+-]\d+)\s+(\w+)'\)/gi, (_, n, u) =>
    `(NOW() + INTERVAL '${n} ${u}')`
  );
  q = q.replace(/date\('now',\s*'([+-]\d+)\s+(\w+)'\)/gi, (_, n, u) =>
    `(CURRENT_DATE + INTERVAL '${n} ${u}')`
  );
  q = q.replace(/datetime\('now'\)/gi, "NOW()");
  q = q.replace(/date\('now'\)/gi, "CURRENT_DATE");
  // ? → $1, $2, ...
  let i = 0;
  q = q.replace(/\?/g, () => `$${++i}`);
  return q;
}

export async function sql(query, params = []) {
  const { rows } = await pool.query(normalize(query), params);
  return rows;
}

export const uuid = () => randomUUID();
