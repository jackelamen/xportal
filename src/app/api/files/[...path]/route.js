import { getClientSession, getOperatorSession } from "@/lib/auth";
import { downloadUpload, contentTypeFor } from "@/lib/storage";

// Serves uploaded files (deliverable documents, logos) to authenticated users.
export async function GET(request, { params }) {
  const [client, operator] = await Promise.all([getClientSession(), getOperatorSession()]);
  if (!client && !operator) return new Response("Unauthorized", { status: 401 });

  const { path: parts } = await params;
  const storedPath = ["uploads", ...parts].join("/");
  const buffer = await downloadUpload(storedPath);
  if (!buffer) return new Response("Not found", { status: 404 });

  const name = parts[parts.length - 1];
  return new Response(buffer, {
    headers: {
      "Content-Type": contentTypeFor(name),
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
