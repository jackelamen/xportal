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
