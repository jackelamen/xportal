"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";

// Native file inputs render as dim, unclickable-looking text. This wraps a
// visually-hidden input in a button-styled label so "attach a file" reads as
// an obvious action, and echoes the chosen filename next to it.
export default function FilePicker({ name = "file", accept, required, label = "Choose file…" }) {
  const [fileName, setFileName] = useState("");
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-sm text-ink-soft transition-colors hover:border-accent hover:text-ink">
        <Paperclip size={14} /> {label}
      </span>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
      />
      <span className={`max-w-44 truncate text-xs ${fileName ? "text-ink" : "text-ink-muted"}`}>
        {fileName || "No file selected"}
      </span>
    </label>
  );
}
