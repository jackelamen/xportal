import fs from "node:fs";
import { getClientSession, getOperatorSession } from "@/lib/auth";
import { resolveUpload, contentTypeFor } from "@/lib/storage";

// Serves uploaded files (deliverable documents, logos) to authenticated users.
export async function GET(request, { params }) {
  const [client, operator] = await Promise.all([getClientSession(), getOperatorSession()]);
  if (!client && !operator) return new Response("Unauthorized", { status: 401 });

  const { path: parts } = await params;
  const storedPath = ["uploads", ...parts].join("/");
  const abs = resolveUpload(storedPath);
  if (!abs) return new Response("Not found", { status: 404 });

  const name = parts[parts.length - 1];
  return new Response(fs.readFileSync(abs), {
    headers: {
      "Content-Type": contentTypeFor(name),
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
