"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Reply, MailOpen, Mail } from "lucide-react";
import { toast } from "@/components/Toaster";
import { t as translate } from "@/lib/i18n";

const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const DATE_LOCALE = { en: "en-US", ko: "ko-KR" };
const dayLabel = (ts, locale, t) => {
  const d = new Date(ts.replace(" ", "T"));
  const today = new Date();
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff === 0) return t("messages.today");
  if (diff === 1) return t("messages.yesterday");
  return d.toLocaleDateString(DATE_LOCALE[locale] || "en-US", { weekday: "short", month: "short", day: "numeric" });
};

export default function MessageFeed({ projectId, invoiceId = null, messages, locale = "en" }) {
  const router = useRouter();
  const t = (key, vars) => translate(locale, key, vars);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const inputRef = useRef(null);

  // Deep link: ?tab=messages#msg-<id> scrolls to and highlights the message.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#msg-")) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ block: "center" });
      setHighlighted(hash.slice(5));
    }
  }, []);

  async function setRead(id, read) {
    const res = await fetch(`/api/messages/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    if (!res.ok) {
      toast.error(t("messages.toastReadError"));
      return;
    }
    router.refresh();
  }

  function startReply(m) {
    setText(`@${m.sender_name || "team"} `);
    inputRef.current?.focus();
    if (m.sender_type === "Internal_Operator" && !m.is_read) setRead(m.id, true);
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, invoice_id: invoiceId, message_content: text }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("messages.toastSendError"));
      return;
    }
    setText("");
    toast(t("messages.toastSent"));
    router.refresh();
  }

  let lastDay = null;

  return (
    <div>
      <div className="space-y-4">
        {messages.length === 0 && (
          <p className="rounded-xl border border-line bg-bg-secondary p-5 text-sm text-ink-soft">
            {t("messages.empty")}
          </p>
        )}
        {messages.map((m) => {
          const fromTeam = m.sender_type === "Internal_Operator";
          const isNew = fromTeam && !m.is_read;
          const day = dayLabel(m.created_at, locale, t);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={m.id}>
              {showDay && (
                <div className="flex items-center gap-3 py-1" aria-hidden>
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-data text-[11px] text-ink-muted">{day}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div
                id={`msg-${m.id}`}
                className={`flex gap-3 scroll-mt-24 ${fromTeam ? "" : "flex-row-reverse"}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    fromTeam ? "bg-accent/15 text-accent" : "bg-bg-tertiary text-ink-soft"
                  }`}
                  title={m.sender_name || (fromTeam ? t("messages.projectTeam") : t("messages.you"))}
                >
                  {initials(m.sender_name || (fromTeam ? "PT" : "You"))}
                </span>
                <div className={`min-w-0 max-w-[80%] ${fromTeam ? "" : "text-right"}`}>
                  <p className={`flex items-center gap-2 text-xs text-ink-muted ${fromTeam ? "" : "justify-end"}`}>
                    <span className="font-medium text-ink-soft">
                      {m.sender_name || (fromTeam ? t("messages.projectTeam") : t("messages.you"))}
                    </span>
                    <span className="font-data">{m.created_at.slice(11, 16)}</span>
                    {isNew && (
                      <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-white">
                        {t("messages.new")}
                      </span>
                    )}
                  </p>
                  <div
                    className={`mt-1 inline-block rounded-xl border px-3.5 py-2.5 text-left text-sm text-ink transition-colors duration-700 ${
                      fromTeam ? "rounded-tl-sm bg-bg-secondary" : "rounded-tr-sm bg-accent/10"
                    } ${
                      highlighted === m.id ? "border-accent" : isNew ? "border-accent/50" : fromTeam ? "border-line" : "border-accent/20"
                    }`}
                  >
                    {m.message_content}
                  </div>
                  {fromTeam && (
                    <div className="mt-1.5 flex gap-3 text-xs text-ink-muted">
                      <button onClick={() => startReply(m)} className="flex items-center gap-1 hover:text-ink">
                        <Reply size={12} /> {t("messages.reply")}
                      </button>
                      {isNew ? (
                        <button onClick={() => setRead(m.id, true)} className="flex items-center gap-1 hover:text-ink">
                          <MailOpen size={12} /> {t("messages.markRead")}
                        </button>
                      ) : (
                        <button onClick={() => setRead(m.id, false)} className="flex items-center gap-1 hover:text-ink">
                          <Mail size={12} /> {t("messages.markUnread")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      <form onSubmit={send} className="mt-5 flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("messages.placeholder")}
          className="flex-1 rounded-lg border border-line bg-bg-secondary px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          disabled={busy || !text.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Send size={14} /> {t("messages.send")}
        </button>
      </form>
    </div>
  );
}
