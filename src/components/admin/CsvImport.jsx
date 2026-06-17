"use client";

import { useState } from "react";
import { Paperclip, Upload, Download } from "lucide-react";
import { parseProjectImport, summarizeImport } from "@/lib/csv";

// Operator widget for importing a project from a section-keyed CSV (see
// lib/csv.js). Previews counts/warnings client-side, then POSTs the raw text to
// /api/admin/imports — which re-parses as the trust boundary.
export default function CsvImport({ mode, clientId, projectId }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setCsv(text);
      setPreview(parseProjectImport(text));
    };
    reader.readAsText(file);
  }

  async function onConfirm() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? { client_id: clientId, csv } : { project_id: projectId, csv }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.errors?.join(" ") || json.error || "Import failed.");
        return;
      }
      window.location.href = `/admin/projects/${json.project_id}`;
    } catch (err) {
      setError(`Import failed: ${err?.message || "network error"}`);
    } finally {
      setBusy(false);
    }
  }

  const noTitle = mode === "create" && preview && !preview.project.title;
  const blocked = preview && (preview.errors.length > 0 || noTitle);

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink-soft transition-colors hover:border-accent hover:text-ink">
            <Paperclip size={14} /> Choose CSV…
          </span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          <span className={`max-w-44 truncate text-xs ${fileName ? "text-ink" : "text-ink-muted"}`}>
            {fileName || "No file selected"}
          </span>
        </label>
        <a href="/project-template.csv" download className="flex items-center gap-1.5 text-xs text-accent hover:underline">
          <Download size={13} /> Download template
        </a>
      </div>

      {preview && (
        <div className="mt-3 rounded-lg border border-line bg-bg-tertiary p-3">
          <p className="text-ink-soft">
            {mode === "create" ? "Will create project " : "Will import into this project — "}
            {preview.project.title && <span className="font-medium text-ink">“{preview.project.title}” </span>}
            {noTitle && <span className="text-danger">(no title — add a “project,title,…” row) </span>}
            {mode === "create" && (preview.project.title || noTitle) ? "with " : ""}
            {summarizeImport(preview)}.
          </p>

          {preview.errors.map((e, i) => (
            <p key={`e${i}`} className="mt-1 text-xs text-danger">{e}</p>
          ))}
          {preview.warnings.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-warn">
              {preview.warnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}
            </ul>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || blocked}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-2 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            <Upload size={14} /> {busy ? "Importing…" : mode === "create" ? "Create project" : "Import"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
