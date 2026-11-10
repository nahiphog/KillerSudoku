import { describe, expect, it } from 'vitest';
import { customLayoutError, generateCustomPuzzle } from '../src/engine/customBuilder';
import { countKillerSolutions } from '../src/engine/digging';
import { UNITS } from '../src/vendor/sudokui/board';
import { generateVerifiedPuzzle } from '../src/engine/verifiedGenerator';

const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
describe('custom cage construction', () => {
  it('requires disjoint connected cages with valid cell indices', () => {
    for (const layout of [[], [[]], [[0, 0]], [[0], [0]], [[0, 10]], [[8, 9]], [[-1]], [[81]], [[0.5]], [Array.from({ length: 10 }, (_, i) => i)]]) {
      expect(customLayoutError(layout)).not.toBeNull();
    }
    expect(customLayoutError([[0, 1, 10], [80]])).toBeNull();
  });
  it('preserves the exact layout and verifies uniqueness from no given digits', () => {
    // Include a cage crossing a box boundary and allow uncovered cells.
    const groups = [[2, 3, 12], ...Array.from({ length: 81 }, (_, i) => i).filter(i => ![2, 3, 12, 80].includes(i)).map(i => [i])];
    const snapshot = JSON.stringify(groups);
    const puzzle = generateCustomPuzzle(groups, { random: rng(7), maxAttempts: 10 });
    expect(JSON.stringify(groups)).toBe(snapshot);
    expect(puzzle.cages.map(c => c.cells)).toEqual(groups);
    for (const unit of UNITS) expect(new Set(unit.map(i => puzzle.values[i])).size).toBe(9);
    for (const cage of puzzle.cages) {
      expect(new Set(cage.cells.map(i => puzzle.values[i])).size).toBe(cage.cells.length);
      expect(cage.sum).toBe(cage.cells.reduce((sum, i) => sum + puzzle.values[i], 0));
    }
    expect(countKillerSolutions(puzzle.cages)).toBe(1);
  });
  it('rejects ambiguous layouts and unfinished searches without changing the input', () => {
    expect(() => generateCustomPuzzle(UNITS.slice(0, 9))).toThrow('cannot specify a unique solution');
    const groups = [[0, 1]];
    expect(() => generateCustomPuzzle(groups, { random: rng(4), maxAttempts: 1 })).toThrow('No unique puzzle');
    expect(() => generateCustomPuzzle(groups, { maxMilliseconds: 0 })).toThrow('No unique puzzle');
    expect(groups).toEqual([[0, 1]]);
  });
  it('finds new sums for a multi-cell cage layout', () => {
    const layout = generateVerifiedPuzzle({}, { random: rng(3) }).cages.map(cage => cage.cells);
    const puzzle = generateCustomPuzzle(layout, { random: rng(8), maxMilliseconds: 20000 });
    expect(puzzle.cages.map(cage => cage.cells)).toEqual(layout);
    expect(countKillerSolutions(puzzle.cages)).toBe(1);
  }, 30000);
});
