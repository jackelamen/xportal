"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Upload, Inbox } from "lucide-react";
import { toast } from "@/components/Toaster";
import FilePicker from "@/components/FilePicker";
import { t as translate } from "@/lib/i18n";

const CATEGORY_KEY = {
  contract: "documents.categoryContract",
  agreement: "documents.categoryAgreement",
  reference: "documents.categoryReference",
  brand: "documents.categoryBrand",
  report: "documents.categoryReport",
};
const ORDER = ["contract", "agreement", "brand", "report", "reference"];

const docHref = (d) =>
  d.kind === "file" ? `/api/${d.asset_path.replace(/^uploads\//, "files/")}` : d.asset_path;

export default function DocumentLibrary({ projectId, documents, fileRequests, locale = "en" }) {
  const router = useRouter();
  const t = (key, vars) => translate(locale, key, vars);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");

  async function upload(e, fileRequestId = null, requestTitle = null) {
    e.preventDefault();
    const input = e.target.querySelector("input[type=file]");
    const file = input?.files?.[0];
    if (!file) {
      toast.error(t("documents.toastChooseFile"));
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("title", fileRequestId ? requestTitle : title.trim() || file.name);
    if (fileRequestId) form.set("file_request_id", fileRequestId);

    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      toast.error((await res.json()).error || t("documents.toastUploadFailed"));
      return;
    }
    toast(fileRequestId ? t("documents.toastRequestFulfilled") : t("documents.toastUploaded"));
    setTitle("");
    if (input) input.value = "";
    router.refresh();
  }

  const grouped = ORDER.map((cat) => [cat, documents.filter((d) => d.category === cat)]).filter(
    ([, docs]) => docs.length > 0
  );

  return (
    <div className="space-y-5">
      {fileRequests.length > 0 && (
        <div className="rounded-lg border border-warn/40 bg-bg-tertiary p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-warn">
            <Inbox size={15} /> {t("documents.filesWeNeed")}
          </p>
          <ul className="mt-3 space-y-3">
            {fileRequests.map((fr) => (
              <li key={fr.id}>
                <p className="text-sm text-ink">{fr.title}</p>
                {fr.note && <p className="text-xs text-ink-soft">{fr.note}</p>}
                <form onSubmit={(e) => upload(e, fr.id, fr.title)} className="mt-1.5 flex flex-wrap items-center gap-2">
                  <FilePicker locale={locale} />
                  <button
                    disabled={busy}
                    className="rounded-lg bg-warn px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {t("documents.upload")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {grouped.map(([cat, docs]) => (
        <div key={cat}>
          <p className="font-data text-[10.5px] font-semibold uppercase tracking-widest text-ink-muted">
            {t(CATEGORY_KEY[cat])}
          </p>
          <ul className="mt-2 space-y-1.5">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                {d.kind === "file" ? (
                  <FileText size={14} className="shrink-0 text-accent" />
                ) : (
                  <Link2 size={14} className="shrink-0 text-accent" />
                )}
                <a href={docHref(d)} target="_blank" rel="noreferrer" className="text-ink hover:text-accent hover:underline">
                  {d.title}
                </a>
                <span className="text-xs text-ink-muted">
                  {d.uploaded_by_name ? t("documents.byUploader", { name: d.uploaded_by_name }) : ""}{d.created_at.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {grouped.length === 0 && <p className="text-sm text-ink-muted">{t("documents.noDocuments")}</p>}

      <form onSubmit={(e) => upload(e)} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
        <label className="block text-xs text-ink-soft">
          {t("documents.addReference")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("documents.titlePlaceholder")}
            className="mt-1 block w-56 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <FilePicker locale={locale} />
        <button
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Upload size={14} /> {busy ? t("documents.uploading") : t("documents.upload")}
        </button>
      </form>
    </div>
  );
}
