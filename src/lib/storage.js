import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// File storage abstraction. Phase 1 writes under ./uploads; Phase 2 swaps the
// bodies of these two functions for Supabase Storage without touching callers.
// Stored paths look like "uploads/ab12cd.../report.pdf" and are served through
// the authenticated /api/files/[...path] route.

const ROOT = path.resolve(process.env.UPLOAD_DIR || "./uploads");

export async function saveUpload(file, subdir = "misc") {
  const safeName = (file.name || "file").replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const dir = path.join(ROOT, subdir, randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, safeName);
  fs.writeFileSync(abs, Buffer.from(await file.arrayBuffer()));
  return { storedPath: path.relative(path.dirname(ROOT), abs), originalName: file.name || safeName };
}

// Resolves a stored path to an absolute filesystem path, refusing traversal.
export function resolveUpload(storedPath) {
  const abs = path.resolve(path.dirname(ROOT), storedPath);
  if (!abs.startsWith(ROOT + path.sep)) return null;
  return fs.existsSync(abs) ? abs : null;
}

export const isFilePath = (assetPath) => assetPath.startsWith("uploads/");

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
