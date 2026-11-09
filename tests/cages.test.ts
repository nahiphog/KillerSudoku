import { describe, expect, it } from 'vitest';
import { cageOptionsError, generateCages, orthogonalNeighbors } from '../src/engine/cages';
import { generateFullGrid } from '../src/engine/generator';

function seededRandom(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

describe('cage generation', () => {
  it('partitions 200 completed grids into connected cages with correct sums and distinct digits', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = seededRandom(seed);
      const grid = generateFullGrid(random);
      const original = Array.from(grid.values);
      const cages = generateCages(grid.values, random);
      const shapes = new Set(cages.map(c => c.cells.join(',')));
      expect(cages.flatMap(c => c.cells).sort((a, b) => a - b)).toEqual(Array.from({ length: 81 }, (_, i) => i));
      for (const cage of cages) {
        expect(cage.cells.length).toBeGreaterThanOrEqual(2);
        expect(cage.cells.length).toBeLessThanOrEqual(7);
        expect(shapes.has(cage.cells.map(i => 80 - i).sort((a, b) => a - b).join(','))).toBe(true);
        expect(new Set(cage.cells.map(i => grid.values[i])).size).toBe(cage.cells.length);
        expect(cage.sum).toBe(cage.cells.reduce((sum, i) => sum + grid.values[i], 0));
        expect(cage.cells[0]).toBe(Math.min(...cage.cells));
        const reached = new Set([cage.cells[0]]);
        for (const cell of reached) {
          for (const neighbor of orthogonalNeighbors(cell)) {
            if (cage.cells.includes(neighbor)) reached.add(neighbor);
          }
        }
        expect(reached.size).toBe(cage.cells.length);
      }
      expect(Array.from(grid.values)).toEqual(original);
    }
  });

  it('can regenerate different cage layouts on the same solution', () => {
    const grid = generateFullGrid(seededRandom(42));
    const layouts = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(generateCages(grid.values, seededRandom(i + 1)))));
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('terminates with no singletons for constant random sources', () => {
    const grid = generateFullGrid(seededRandom(5));
    for (const value of [0, 0.5, 0.999999]) {
      const cages = generateCages(grid.values, () => value);
      expect(cages.every(cage => cage.cells.length >= 2)).toBe(true);
      expect(cages.flatMap(cage => cage.cells)).toHaveLength(81);
    }
  });

  it('rejects incomplete, malformed, or invalid completed grids', () => {
    for (const values of [[], new Uint8Array(81), Array(81).fill(1), Array(81).fill(10)]) {
      expect(() => generateCages(values)).toThrow('valid completed Sudoku');
    }
  });

  it('does not wrap neighbors across row boundaries', () => {
    expect(orthogonalNeighbors(8)).toEqual([17, 7]);
    expect(orthogonalNeighbors(9)).toEqual([0, 18, 10]);
  });

  it('honors restricted sizes with symmetry on and off', () => {
    for (const symmetric of [true, false]) for (const sizes of [[3], [9], [2, 3], [3, 5, 7], [2, 5], [4, 5]]) {
      const random = seededRandom(42);
      const grid = generateFullGrid(random);
      // Restrictive selections may exhaust the bounded search; no invalid fallback is allowed.
      try {
        const cages = generateCages(grid.values, { sizes, symmetric }, random);
        expect(cages.flatMap(c => c.cells).sort((a, b) => a - b)).toEqual(Array.from({ length: 81 }, (_, i) => i));
        for (const cage of cages) {
          expect(sizes).toContain(cage.cells.length);
          expect(new Set(cage.cells.map(i => grid.values[i])).size).toBe(cage.cells.length);
          if (symmetric) expect(cages.some(c => c.cells.join(',') === cage.cells.map(i => 80 - i).sort((a, b) => a - b).join(','))).toBe(true);
        }
      } catch (error) {
        expect(sizes.includes(3) || sizes.includes(9)).toBe(false);
        expect((error as Error).message).toContain('search limit');
      }
    }
  });

  it('rejects impossible selections rather than silently using other sizes', () => {
    const grid = generateFullGrid(seededRandom(3));
    for (const sizes of [[], [2], [2, 4, 6, 8], [5], [7], [1], [10]]) {
      expect(cageOptionsError({ sizes })).not.toBeNull();
      expect(() => generateCages(grid.values, { sizes })).toThrow();
    }
    expect(cageOptionsError({ sizes: [2, 5] })).toBeNull();
  });
});
