import { NextResponse } from "next/server";

// The client sign-in pages ("/" and "/p/<slug>") read a locale cookie and
// Accept-Language header (see lib/i18n/loginLocale.js), which forces Next.js
// into fully dynamic rendering - correct, since the response is personalized
// per visitor. But Next's default Cache-Control for a dynamic page is
// "private, no-cache, no-store, must-revalidate", and a "no-store" HTML
// response is a documented blocker for Chrome's PWA install eligibility.
// That's the reason /admin/login (static, no cookies read, cacheable) was
// installable while these pre-auth pages weren't, even though there's no
// sensitive data on either to protect from caching.
//
// Relaxing to "private, must-revalidate" keeps it out of shared/CDN caches
// and always revalidated (so the right locale still renders every visit),
// while letting the browser itself retain a copy - enough for Chrome to
// consider the page installable. Authenticated /portal pages are untouched:
// those hold real client data and should stay no-store.
export function middleware() {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, must-revalidate");
  return res;
}

export const config = {
  matcher: ["/", "/p/:slug*"],
};
