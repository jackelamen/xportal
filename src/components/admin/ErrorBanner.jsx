"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AlertCircle, X } from "lucide-react";

// Reads ?error= left by lib/admin.js's errorRedirect and shows it inline in
// red instead of the raw-text error page a form POST used to land on — in
// the installed PWA there's no browser back button to escape that with.
// Strips the param from the URL on mount so a refresh doesn't re-show it.
export default function ErrorBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (!err) return;
    setMessage(err);
    const next = new URLSearchParams(searchParams);
    next.delete("error");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (!message) return null;

  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1">{message}</p>
      <button onClick={() => setMessage(null)} className="shrink-0 text-danger/70 hover:text-danger">
        <X size={15} />
      </button>
    </div>
  );
}
