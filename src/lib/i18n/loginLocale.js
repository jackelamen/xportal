import { cookies, headers } from "next/headers";
import { resolveLocale } from "@/lib/i18n";

export const LOCALE_COOKIE = "xportal_locale";

// Pre-auth pages have no client_users row yet, so the login language comes from
// an explicit cookie (set by the switcher) first, then the browser's
// Accept-Language, then the default. Once signed in, client_users.locale wins.
export async function getLoginLocale() {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (cookieLocale) return resolveLocale(cookieLocale);
  const accept = (await headers()).get("accept-language") || "";
  return accept.toLowerCase().startsWith("ko") ? "ko" : "en";
}
