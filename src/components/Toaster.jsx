"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

// Tiny dependency-free toast bus: toast("Approved") / toast.error("Nope").
let listeners = [];
export function toast(message) { emit({ message, kind: "ok" }); }
toast.error = (message) => emit({ message, kind: "error" });
const emit = (t) => listeners.forEach((fn) => fn({ ...t, id: Date.now() + Math.random() }));

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const add = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.push(add);
    return () => { listeners = listeners.filter((fn) => fn !== add); };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
            t.kind === "error"
              ? "border-danger/40 bg-bg-secondary text-danger"
              : "border-accent-2/40 bg-bg-secondary text-ink"
          }`}
        >
          {t.kind === "error" ? (
            <AlertCircle size={15} className="text-danger" />
          ) : (
            <CheckCircle2 size={15} className="text-accent-2" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
