import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// File storage on Supabase Storage (private "uploads" bucket). Stored paths
// look like "uploads/documents/ab12cd.../report.pdf" and are served through
// the authenticated /api/files/[...path] route, which downloads the object
// server-side using the service-role key (bucket has no public access).

const BUCKET = "uploads";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function saveUpload(file, subdir = "misc") {
  const safeName = (file.name || "file").replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const key = `${subdir}/${randomUUID()}/${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || contentTypeFor(safeName),
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { storedPath: `${BUCKET}/${key}`, originalName: file.name || safeName };
}

// Downloads a previously-saved object. Returns null if missing.
export async function downloadUpload(storedPath) {
  const key = storedPath.startsWith(`${BUCKET}/`) ? storedPath.slice(BUCKET.length + 1) : storedPath;
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export function contentTypeFor(name) {
  const ext = name.toLowerCase().split(".").pop();
  return (
    {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
      txt: "text/plain",
      csv: "text/csv",
      zip: "application/zip",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }[ext] || "application/octet-stream"
  );
}
