import { expect, it } from 'vitest';
import { traceLogically } from '../src/engine/verifiedGenerator';
import { solveKillerBySearch } from '../src/engine/digging';
import { nextKillerStep, startSolver, applyDeduction } from '../src/engine/killerSolver';
import { UNITS, gridFromValues } from '../src/vendor/sudokui/board';

it('only uses Brute Force at a logical stall, then retries logic to completion', () => {
  const cages = UNITS.slice(0,9).map(cells=>({cells,sum:45}));
  const logical = traceLogically(cages)!;
  expect(logical.complete).toBe(false);
  expect(logical.techniqueTally['Brute Force']).toBeUndefined();
  const trace = traceLogically(cages,Date.now()+30000,true)!;
  expect(trace.complete).toBe(true);
  expect(trace.techniqueTally['Brute Force']).toBeGreaterThan(0);
  let replay = startSolver();
  for (const step of trace.deductions) {
    if (step.technique === 'Brute Force') {
      expect(nextKillerStep(replay,cages).status).toBe('stalled');
      expect(step.placements).toHaveLength(1);
      expect(step.supportDigits).toEqual([]);
    }
    replay = applyDeduction(replay,cages,step);
  }
  expect(nextKillerStep(replay,cages).status).toBe('solved');
  expect(Array.from(replay.values)).toEqual(trace.values);
}, 60000);

it('search respects cages and current candidates without changing its input', () => {
  const grid = startSolver();
  const before = Array.from(grid.cands);
  const cages = [{cells:[0,1],sum:3}];
  const solution = solveKillerBySearch(cages,grid,Date.now()+10000)!;
  expect(solution[0]+solution[1]).toBe(3);
  expect(nextKillerStep(gridFromValues(solution),cages).status).toBe('solved');
  expect(Array.from(grid.cands)).toEqual(before);
  expect(Array.from(grid.values).every(v=>v===0)).toBe(true);
  expect(solveKillerBySearch([{cells:[0,1],sum:2}],grid)).toBeNull();
  grid.cands[0] = 4; // Digit 3 cannot belong to a two-cell cage summing to 3.
  expect(solveKillerBySearch(cages,grid)).toBeNull();
});
