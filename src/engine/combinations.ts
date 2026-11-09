export interface CombinationRow {
  sum: number;
  combinations: number[][];
}

/** All unordered sets of distinct digits 1–9, grouped by sum. */
export function combinationTable(size: number): CombinationRow[] {
  if (!Number.isInteger(size) || size < 2 || size > 9) {
    throw new Error('Choose a cage size from 2 to 9.');
  }
  const bySum = new Map<number, number[][]>();
  function visit(digits: number[], next: number, sum: number) {
    if (digits.length === size) {
      const combinations = bySum.get(sum) ?? [];
      combinations.push(digits);
      bySum.set(sum, combinations);
      return;
    }
    const remaining = size - digits.length;
    for (let digit = next; digit <= 10 - remaining; digit++) {
      visit([...digits, digit], digit + 1, sum + digit);
    }
  }
  visit([], 1, 0);
  return [...bySum].sort(([a], [b]) => a - b).map(([sum, combinations]) => ({ sum, combinations }));
}
