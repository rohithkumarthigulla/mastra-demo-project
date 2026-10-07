/** Groups the integer part the Indian way: last three digits, then pairs (12,34,567). */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

/**
 * Rupees with Indian digit grouping and paise: `formatRupees(12500) === '₹12,500.00'`.
 * Built by hand rather than with `Intl` because Hermes on Android ships without the
 * `en-IN` locale data and would fall back to Western grouping.
 */
export function formatRupees(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const [whole, paise] = Math.abs(amount).toFixed(2).split('.');
  return `${sign}₹${groupIndian(whole!)}.${paise}`;
}

/** "₹12,500.00 / day" for listing cards and detail pages. */
export function formatDailyRate(amount: number): string {
  return `${formatRupees(amount)} / day`;
}
