import { describe, expect, it } from 'vitest';
import { applyDeduction, cageSupports, nextKillerStep, startSolver } from '../src/engine/killerSolver';
import { bit, gridFromValues, UNITS } from '../src/vendor/sudokui/board';
import { generateFullGrid } from '../src/engine/generator';
import { generateCages, type Cage } from '../src/engine/cages';
import { combinationTable } from '../src/engine/combinations';

const rowCages: Cage[] = UNITS.slice(0, 9).map(cells => ({ cells, sum: 45 }));
function rng(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

describe('Killer Sudoku deductions', () => {
  it('starts blank, with no access to a generated solution', () => {
    expect(Array.from(startSolver().values)).toEqual(Array(81).fill(0));
    expect(nextKillerStep(startSolver(), rowCages).status).toBe('stalled');
  });

  it('uses cell-specific assignment support, not just the union of a combination', () => {
    const grid = startSolver();
    grid.cands[0] = bit(1) | bit(2);
    grid.cands[1] = bit(1);
    expect(cageSupports(grid, { cells: [0, 1], sum: 3 })).toEqual({ combinations: [[1, 2]], supports: [bit(2), bit(1)] });
    grid.cands[0] = bit(1);
    expect(cageSupports(grid, { cells: [0, 1], sum: 3 }).combinations).toEqual([]);
  });

  it('matches exhaustive cage assignments for random candidate restrictions', () => {
    const random = rng(71);
    for (let trial = 0; trial < 60; trial++) {
      const size = 2 + trial % 4;
      const grid = startSolver();
      const cells = Array.from({ length: size }, (_, i) => i);
      const row = combinationTable(size)[trial % combinationTable(size).length];
      for (const cell of cells) grid.cands[cell] = Math.floor(random() * 511) + 1;
      const expected = cells.map(() => 0);
      function enumerate(index: number, values: number[]) {
        if (index === size) {
          if (values.reduce((s, d) => s + d, 0) === row.sum) values.forEach((d, i) => { expected[i] |= bit(d); });
          return;
        }
        for (let digit = 1; digit <= 9; digit++) if ((grid.cands[index] & bit(digit)) && !values.includes(digit)) enumerate(index + 1, [...values, digit]);
      }
      enumerate(0, []);
      expect(cageSupports(grid, { cells, sum: row.sum }).supports).toEqual(expected);
    }
  });

  it('applies imported Naked Single after cage candidate filtering', () => {
    const grid = startSolver(); grid.cands[0] = bit(1);
    const first = nextKillerStep(grid, rowCages);
    expect(first.status).toBe('step');
    if (first.status !== 'step') throw new Error('Expected deduction');
    const next = nextKillerStep(applyDeduction(grid, rowCages, first.step), rowCages);
    expect(next.status).toBe('step');
    if (next.status === 'step') {
      expect(next.step.technique).toBe('Naked Single');
      expect(next.step.placements).toEqual([{ cell: 0, digit: 1 }]);
    }
    expect(grid.values[0]).toBe(0);
  });

  it('solves a final cage remainder and validates all cage sums at completion', () => {
    const solution = generateFullGrid(rng(10));
    const values = Array.from(solution.values); values[0] = 0;
    const grid = gridFromValues(values);
    const result = nextKillerStep(grid, rowCages);
    expect(result.status).toBe('step');
    if (result.status !== 'step') throw new Error('Expected deduction');
    expect(result.step.technique).toBe('Cage remainder');
    const completed = applyDeduction(grid, rowCages, result.step);
    expect(nextKillerStep(completed, rowCages).status).toBe('solved');
    expect(nextKillerStep(completed, rowCages.map((c, i) => i ? c : { ...c, sum: 44 })).status).toBe('contradiction');
  });

  it('preserves the known solution through logical deductions on generated cages', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const random = rng(seed);
      const solution = generateFullGrid(random);
      const cages = generateCages(solution.values, {}, random);
      let grid = startSolver();
      for (let index = 0; index < 150; index++) {
        const before = Array.from(grid.cands);
        const result = nextKillerStep(grid, cages);
        expect(result.status).not.toBe('contradiction');
        if (result.status !== 'step') break;
        for (const p of result.step.placements) expect(p.digit).toBe(solution.values[p.cell]);
        for (const e of result.step.eliminations) expect(e.digit).not.toBe(solution.values[e.cell]);
        const next = applyDeduction(grid, cages, result.step);
        expect(Array.from(grid.cands)).toEqual(before);
        for (let i = 0; i < 81; i++) expect(next.values[i] || (next.cands[i] & bit(solution.values[i]))).toBeTruthy();
        grid = next;
      }
    }
  });
});
