// Currency formatting for invoices. Intl handles the symbol and the right
// number of decimals per currency (USD 2, KRW 0) and, given the viewer's
// locale, the symbol placement and grouping.

export const CURRENCIES = ["USD", "KRW"];
const LOCALE_TAG = { en: "en-US", ko: "ko-KR" };

export function formatMoney(amount, currency = "USD", locale = "en") {
  const n = Number(amount) || 0;
  const cur = CURRENCIES.includes(currency) ? currency : "USD";
  try {
    return new Intl.NumberFormat(LOCALE_TAG[locale] || "en-US", { style: "currency", currency: cur }).format(n);
  } catch {
    return `${cur} ${n}`;
  }
}

// Splits the currency symbol from the figure. Some symbols (₩) aren't in our
// UI font's glyph set and fall back to a system font that draws them much
// taller than our digits - the <Money> component uses this to size the
// symbol independently so every currency looks consistent regardless of
// which font ends up rendering the glyph.
export function formatMoneyParts(amount, currency = "USD", locale = "en") {
  const n = Number(amount) || 0;
  const cur = CURRENCIES.includes(currency) ? currency : "USD";
  try {
    const parts = new Intl.NumberFormat(LOCALE_TAG[locale] || "en-US", { style: "currency", currency: cur }).formatToParts(n);
    const symbol = parts.filter((p) => p.type === "currency").map((p) => p.value).join("");
    const number = parts.filter((p) => p.type !== "currency").map((p) => p.value).join("");
    return { symbol, number };
  } catch {
    return { symbol: "", number: `${cur} ${n}` };
  }
}
