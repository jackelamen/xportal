import { saveUpload } from "./storage";

const MAX_FILE = 25_000_000;

// Parses an admin form into a deliverable version: uploaded file or link.
export async function buildVersion(form) {
  const note = String(form.get("note") || "").trim() || null;
  const file = form.get("file");
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > MAX_FILE) return { error: "File must be under 25 MB" };
    const saved = await saveUpload(file, "deliverables");
    return { kind: "file", assetPath: saved.storedPath, originalName: saved.originalName, note };
  }
  const link = String(form.get("link") || "").trim();
  if (/^https?:\/\//.test(link)) {
    return { kind: "link", assetPath: link, originalName: null, note };
  }
  return { error: "Provide either a file or an http(s) link" };
}
