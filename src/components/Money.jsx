import { formatMoneyParts } from "@/lib/money";

// Renders a currency amount with the symbol/code scaled down and muted
// relative to the figure - see formatMoneyParts for why.
export default function Money({ amount, currency, locale = "en", className = "" }) {
  const { symbol, number } = formatMoneyParts(amount, currency, locale);
  return (
    <span className={className}>
      {symbol && <span className="mr-px text-[0.7em] font-normal text-ink-muted">{symbol}</span>}
      {number}
    </span>
  );
}
