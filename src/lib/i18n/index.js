import en from "./dictionaries/en";
import ko from "./dictionaries/ko";

// Client-portal-only i18n. Small and dependency-free by design: the app is a
// server-rendered Next.js portal with a manageable, mostly-static string set,
// so a flat dictionary + lookup beats pulling in a full i18n framework.
const DICTIONARIES = { en, ko };
export const LOCALES = ["en", "ko"];
export const DEFAULT_LOCALE = "en";

export function resolveLocale(locale) {
  return LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

// Reads a dotted key path ("nav.home") out of a dictionary object.
function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

// t("ko", "nav.home") -> "홈"
// t("ko", "attention.count", { n: 3 }) -> template values substitute {n} placeholders.
export function t(locale, key, vars) {
  const dict = DICTIONARIES[resolveLocale(locale)];
  let value = lookup(dict, key);
  if (value === undefined) value = lookup(DICTIONARIES[DEFAULT_LOCALE], key);
  if (value === undefined) return key;
  if (typeof value === "function") return value(vars || {});
  if (vars) {
    return Object.entries(vars).reduce(
      (str, [k, v]) => str.replaceAll(`{${k}}`, v),
      value
    );
  }
  return value;
}

const DATE_LOCALE = { en: "en-US", ko: "ko-KR" };

// Locale-aware date/time formatting wrapper around toLocaleDateString /
// toLocaleTimeString, so every date in the portal renders in the visitor's
// chosen language without each call site tracking the mapping itself.
export function formatDate(locale, isoLikeDate, opts) {
  if (!isoLikeDate) return null;
  const hasTime = isoLikeDate.includes("T") || isoLikeDate.includes(" ");
  const normalized = hasTime ? isoLikeDate.replace(" ", "T") : `${isoLikeDate}T00:00`;
  return new Date(normalized).toLocaleDateString(DATE_LOCALE[resolveLocale(locale)], opts);
}

export function formatTime(locale, isoLikeDate, opts) {
  if (!isoLikeDate) return null;
  const normalized = isoLikeDate.includes("T") ? isoLikeDate : isoLikeDate.replace(" ", "T");
  return new Date(normalized).toLocaleTimeString(DATE_LOCALE[resolveLocale(locale)], {
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });
}
