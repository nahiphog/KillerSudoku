import { describe, expect, it } from 'vitest';
import { combinationTable } from '../src/engine/combinations';

describe('full combinations reference', () => {
  it('lists every distinct-digit set exactly once across all eight tables', () => {
    const counts = [36, 84, 126, 126, 84, 36, 9, 1];
    let rowCount = 0;
    let combinationCount = 0;
    for (let size = 2; size <= 9; size++) {
      const table = combinationTable(size);
      const actual = table.flatMap(row => row.combinations.map(digits => {
        expect(digits).toHaveLength(size);
        expect(new Set(digits).size).toBe(size);
        expect(digits.reduce((sum, d) => sum + d, 0)).toBe(row.sum);
        return digits.join(',');
      }));
      // Independent bitmask enumeration proves completeness, including middle sums.
      const expected: string[] = [];
      for (let mask = 0; mask < 512; mask++) {
        const digits = Array.from({ length: 9 }, (_, i) => i + 1).filter(d => mask & (1 << (d - 1)));
        if (digits.length === size) expected.push(digits.join(','));
      }
      expect(actual.sort()).toEqual(expected.sort());
      expect(actual).toHaveLength(counts[size - 2]);
      const min = size * (size + 1) / 2;
      const max = size * (19 - size) / 2;
      expect(table.map(row => row.sum)).toEqual(Array.from({ length: max - min + 1 }, (_, i) => min + i));
      rowCount += table.length;
      combinationCount += actual.length;
    }
    expect(rowCount).toBe(120);
    expect(combinationCount).toBe(502);
  });

  it('matches reference examples and the nine-cell total', () => {
    expect(combinationTable(2).find(row => row.sum === 10)?.combinations).toEqual([[1, 9], [2, 8], [3, 7], [4, 6]]);
    expect(combinationTable(3).find(row => row.sum === 24)?.combinations).toEqual([[7, 8, 9]]);
    expect(combinationTable(9)).toEqual([{ sum: 45, combinations: [[1, 2, 3, 4, 5, 6, 7, 8, 9]] }]);
  });

  it('rejects sizes outside the reference range', () => {
    for (const size of [1, 10, 2.5, NaN]) expect(() => combinationTable(size)).toThrow();
  });
});
