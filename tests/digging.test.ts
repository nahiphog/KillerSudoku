import { describe, expect, it } from 'vitest';
import { countKillerSolutions, digCages, cageDigGroups } from '../src/engine/digging';
import { generateVerifiedPuzzle } from '../src/engine/verifiedGenerator';
import { applyDeduction, nextKillerStep, startSolver } from '../src/engine/killerSolver';
import { UNITS } from '../src/vendor/sudokui/board';
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

describe('exact cage digging', () => {
  it('distinguishes impossible and ambiguous puzzles and rejects expired checks', () => {
    expect(countKillerSolutions([{ cells: [0, 1], sum: 2 }])).toBe(0);
    expect(countKillerSolutions([])).toBe(2);
    expect(countKillerSolutions(UNITS.slice(0, 9).map(cells => ({ cells, sum: 45 })))).toBe(2);
    expect(() => countKillerSolutions([], 0)).toThrow('timed out');
    expect(() => digCages([])).toThrow('unique starting puzzle');
    expect(() => countKillerSolutions([{cells:[0,0],sum:3}])).toThrow('Invalid');
  });
  it('accepts partial coverage in the logical solver without accepting overlaps', () => {
    expect(nextKillerStep(startSolver(), [{cells:[0,1],sum:3}]).status).toBe('step');
    expect(nextKillerStep(startSolver(), [{cells:[0,0],sum:3}]).status).toBe('contradiction');
  });
  it.each([1, 2])('produces a unique irreducible dug puzzle from seed %i', seed => {
    const progress: number[] = [];
    const puzzle = generateVerifiedPuzzle({dig:true, digPairs:false, logicOnly:false}, {random:rng(seed), maxDigMilliseconds:120000, onDigProgress:p=>progress.push(p.tested)});
    expect(puzzle.digging!.removed).toBeGreaterThan(0);
    expect(puzzle.digging!.tested).toBe(puzzle.digging!.total);
    expect(puzzle.cages.length + puzzle.digging!.removed).toBe(puzzle.digging!.total);
    expect(progress.at(-1)).toBe(puzzle.digging!.total);
    expect(countKillerSolutions(puzzle.cages)).toBe(1);
    for (const cage of puzzle.cages) {
      expect(cage.cells.reduce((sum, cell) => sum + puzzle.values[cell], 0)).toBe(cage.sum);
      expect(countKillerSolutions(puzzle.cages.filter(c=>c!==cage))).toBe(2);
    }
    let replay = startSolver();
    for (const step of puzzle.deductions) {
      if (step.technique === 'Brute Force') expect(nextKillerStep(replay, puzzle.cages).status).toBe('stalled');
      replay = applyDeduction(replay, puzzle.cages, step);
      for (let i=0;i<81;i++) if(replay.values[i]) expect(replay.values[i]).toBe(puzzle.values[i]);
    }
    expect(nextKillerStep(replay,puzzle.cages).status).toBe('solved');
    expect(puzzle.logicallySolved).toBe(!puzzle.techniqueTally['Brute Force']);
    expect(puzzle.elapsedMilliseconds).toBeGreaterThan(0);
  }, 180000);
  it('does not mutate the original cages, or publish an unfinished dig', () => {
    const base = generateVerifiedPuzzle({}, {random:rng(3)});
    const snapshot = JSON.stringify(base.cages);
    expect(countKillerSolutions(base.cages)).toBe(1);
    digCages(base.cages,rng(4),Date.now()+120000);
    expect(JSON.stringify(base.cages)).toBe(snapshot);
    expect(()=>generateVerifiedPuzzle({dig:true},{random:rng(1),maxDigMilliseconds:0})).toThrow('timed out');
  },180000);
});

 it('groups rotational partners once and treats a self-symmetric cage once', () => {
   const cages = [{cells:[0,1],sum:3},{cells:[79,80],sum:4},{cells:[31,40,49],sum:15}];
   expect(cageDigGroups(cages,true)).toEqual([[cages[0],cages[1]],[cages[2]]]);
   expect(cageDigGroups(cages,false)).toHaveLength(3);
   expect(()=>cageDigGroups(cages.slice(0,1),true)).toThrow('rotationally symmetric');
 });
 it('defaults to pair digging and preserves symmetry and pair irreducibility', () => {
   const puzzle = generateVerifiedPuzzle({dig:true}, {random:rng(3),maxDigMilliseconds:120000});
   expect(puzzle.digging?.paired).toBe(true);
   expect(puzzle.techniqueTally['Brute Force']).toBeUndefined();
   expect(puzzle.deductions.every(step=>step.technique !== 'Brute Force')).toBe(true);
   let replay = startSolver();
   for(const step of puzzle.deductions) replay = applyDeduction(replay,puzzle.cages,step);
   expect(nextKillerStep(replay,puzzle.cages).status).toBe(puzzle.logicallySolved ? 'solved' : 'stalled');
   expect(puzzle.digging!.removed).toBeGreaterThan(0);
   expect(countKillerSolutions(puzzle.cages,Date.now()+120000,puzzle.values)).toBe(1);
   for(const group of cageDigGroups(puzzle.cages,true)) {
     expect(countKillerSolutions(puzzle.cages.filter(c=>!group.includes(c)),Date.now()+120000,puzzle.values)).toBe(2);
   }
 },180000);
