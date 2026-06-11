import fs from "node:fs";
import { getDb } from "@/lib/db";
import { resolveUpload, contentTypeFor } from "@/lib/storage";

// Logo for the branded login page — the one upload served pre-auth, looked up
// strictly via the client's slug so arbitrary paths can't be probed.
export async function GET(request, { params }) {
  const { slug } = await params;
  const client = getDb().prepare("SELECT logo_path FROM clients WHERE slug = ?").get(slug);
  if (!client?.logo_path) return new Response("Not found", { status: 404 });
  const abs = resolveUpload(client.logo_path);
  if (!abs) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(abs), {
    headers: { "Content-Type": contentTypeFor(abs), "Cache-Control": "public, max-age=300" },
  });
}
