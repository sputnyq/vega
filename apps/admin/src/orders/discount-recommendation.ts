const DAY_MS = 24 * 60 * 60 * 1000;

/** Recommend a discount from the lead time between today and the move date. */
export function suggestDiscountPercent(
  movingDate: string,
  now = new Date(),
): 5 | 10 | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(movingDate)) return null;
  const [year, month, day] = movingDate.split("-").map(Number);
  const target = new Date(Date.UTC(year!, month! - 1, day!));
  if (target.toISOString().slice(0, 10) !== movingDate) return null;

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAhead = Math.floor((target.getTime() - today) / DAY_MS);
  if (daysAhead >= 60) return 10;
  if (daysAhead >= 30) return 5;
  return null;
}
