import { describe, expect, it } from 'vitest';
import { generateFullGrid } from '../src/engine/generator';
import { TECHNIQUES, applyStep, findNextStep, parseGrid, solve, countSolutions } from '../src/engine/solver';
import { UNITS, gridFromValues, type Grid } from '../src/vendor/sudokui/board';
import examples from './technique-examples.json';

function checkComplete(grid: Grid) {
  for (const unit of UNITS) {
    expect(unit.map(i => grid.values[i]).sort()).toEqual([1,2,3,4,5,6,7,8,9]);
  }
}

describe('completed grid generation', () => {
  it('generates 100 valid grids with varied solutions', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const grid = generateFullGrid();
      checkComplete(grid);
      results.add([...grid.values].join(''));
      expect([...grid.cands].every(value => value === 0)).toBe(true);
    }
    expect(results.size).toBeGreaterThan(95);
  });
});

describe('imported techniques', () => {
  for (const technique of TECHNIQUES.filter(t => t.id !== 'BRUTE_FORCE')) {
    it(`${technique.name} finds its upstream example without changing the board`, () => {
      const example = examples[technique.id as keyof typeof examples];
      const grid = parseGrid(example.values)!;
      grid.cands = Uint16Array.from(example.cands);
      const before = [...grid.values, ...grid.cands];
      const step = technique.find(grid);
      expect(step?.tech).toBe(technique.id);
      expect([...grid.values, ...grid.cands]).toEqual(before);
      expect(step!.placements.length + step!.eliminations.length).toBeGreaterThan(0);
      // Each deduction must preserve at least one solution.
      expect(solve(applyStep(grid, step!))).not.toBeNull();
    });
  }

  it('brute force solves a known puzzle and counts its unique solution', () => {
    const puzzle = parseGrid('530070000600195000098000060800060003400803001700020006060000280000419005000080079')!;
    const solution = solve(puzzle);
    expect(solution).not.toBeNull();
    checkComplete(solution!);
    expect(countSolutions(puzzle)).toBe(1);
    const step = TECHNIQUES.at(-1)!.find(puzzle);
    expect(step?.tech).toBe('BRUTE_FORCE');
    expect(step!.placements).toHaveLength(1);
  });

  it('applies logical steps through completion without mutating inputs', () => {
    const completed = generateFullGrid();
    const values = [...completed.values];
    values[0] = 0;
    const puzzle = gridFromValues(values);
    const step = findNextStep(puzzle);
    expect(step?.tech).toBe('FULL_HOUSE');
    checkComplete(applyStep(puzzle, step!));
    expect(puzzle.values[0]).toBe(0);
    expect(findNextStep(completed)).toBeNull();
  });
});
