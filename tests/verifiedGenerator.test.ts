import { describe, expect, it } from 'vitest';
import { generateVerifiedPuzzle, proveLogically } from '../src/engine/verifiedGenerator';
import { UNITS } from '../src/vendor/sudokui/board';
import { applyDeduction, nextKillerStep, startSolver } from '../src/engine/killerSolver';

function rng(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

describe('verified puzzle generation', () => {
  it('rejects ambiguous nine-cell row cages and incomplete proofs', () => {
    const cages = UNITS.slice(0, 9).map(cells => ({ cells, sum: 45 }));
    expect(proveLogically(cages)).toBeNull();
    expect(proveLogically(cages, 0)).toBeNull();
    expect(() => generateVerifiedPuzzle({ sizes: [9] })).toThrow('cannot give a unique puzzle');
    expect(() => generateVerifiedPuzzle({}, { maxAttempts: 0 })).toThrow('No uniquely solvable puzzle');
  });

  it.each([1, 2, 3, 4, 5])('replays a complete logical proof from blank for default seed %i', seed => {
    const puzzle = generateVerifiedPuzzle({}, { random: rng(seed), maxMilliseconds: 30000 });
    expect(puzzle.proofSteps).toBeGreaterThan(0);
    const proof = proveLogically(puzzle.cages);
    expect(proof?.values).toEqual(puzzle.values);
    expect(proof?.steps).toBe(puzzle.proofSteps);
    for (const unit of UNITS) expect(new Set(unit.map(i => puzzle.values[i])).size).toBe(9);
    for (const cage of puzzle.cages) {
      expect([2, 3, 4, 5, 6, 7]).toContain(cage.cells.length);
      expect(puzzle.cages.some(c => c.cells.join(',') === cage.cells.map(i => 80 - i).sort((a, b) => a - b).join(','))).toBe(true);
    }
    let grid = startSolver();
    for (let index = 0; index < puzzle.proofSteps; index++) {
      const result = nextKillerStep(grid, puzzle.cages);
      expect(result.status).toBe('step');
      if (result.status !== 'step') throw new Error('Incomplete logical proof');
      expect(result.step.technique).not.toBe('Brute Force');
      grid = applyDeduction(grid, puzzle.cages, result.step);
    }
    expect(nextKillerStep(grid, puzzle.cages).status).toBe('solved');
  }, 35000);

  it('respects a restricted size selection with symmetry disabled', () => {
    const puzzle = generateVerifiedPuzzle({ sizes: [2, 3], symmetric: false }, { random: rng(12), maxMilliseconds: 30000 });
    expect(puzzle.cages.every(cage => [2, 3].includes(cage.cells.length))).toBe(true);
    expect(proveLogically(puzzle.cages)?.values).toEqual(puzzle.values);
  }, 35000);
});
