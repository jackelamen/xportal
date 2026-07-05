import { sql } from "@/lib/db";
import { downloadUpload, contentTypeFor } from "@/lib/storage";

// Logo for the branded login page - the one upload served pre-auth, looked up
// strictly via the client's slug so arbitrary paths can't be probed.
export async function GET(request, { params }) {
  const { slug } = await params;
  const client = (await sql("SELECT logo_path FROM clients WHERE slug = ?", [slug]))[0];
  if (!client?.logo_path) return new Response("Not found", { status: 404 });
  const buffer = await downloadUpload(client.logo_path);
  if (!buffer) return new Response("Not found", { status: 404 });
  return new Response(buffer, {
    headers: { "Content-Type": contentTypeFor(client.logo_path), "Cache-Control": "public, max-age=300" },
  });
}
