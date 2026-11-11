import { describe, expect, it } from 'vitest';
import { cageOptionsError, generateCages, type CageOperation } from '../src/engine/cages';
import { generateFullGrid } from '../src/engine/generator';
import { generateVerifiedPuzzle, retainedCageSizesError } from '../src/engine/verifiedGenerator';
import { cageDigGroups, countKillerSolutions, type DigProgress } from '../src/engine/digging';
const rng = (seed: number) => () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed/4294967296; };

describe('optional one-cell cages', () => {
  it.each(['sum', 'product'] as CageOperation[])('supports all-singleton %s puzzles', operation => {
    const random = rng(3);
    const values = generateFullGrid(random).values;
    expect(cageOptionsError({sizes:[1]})).toBeNull();
    const cages = generateCages(values,{sizes:[1],operation},random);
    expect(cages).toHaveLength(81);
    expect(cages.every(c=>c.cells.length===1 && c.sum===values[c.cells[0]])).toBe(true);
    expect(countKillerSolutions(cages)).toBe(1);
  });
  it('retains a selected singleton by default when digging', () => {
    const puzzle = generateVerifiedPuzzle({sizes:[1,2,3],retainedCageSizes:[1,2,3],dig:true},{random:rng(3)});
    expect(puzzle.cages.some(c=>c.cells.length===1)).toBe(true);
    expect(puzzle.logicallySolved).toBe(true);
  },180000);
  it.each([
    {operation:'sum' as const, digPairs:true, logicOnly:true},
    {operation:'product' as const, digPairs:false, logicOnly:false},
  ])('removes every singleton with $operation, paired=$digPairs', options => {
    const progress: DigProgress[] = [];
    const puzzle = generateVerifiedPuzzle({...options,sizes:[1,2,3],retainedCageSizes:[1,2,3],dig:true,digSingletons:true},
      {random:rng(3),onDigProgress:p=>progress.push(p)});
    expect(puzzle.cages.every(c=>c.cells.length>1)).toBe(true);
    for(const size of [2,3]) expect(puzzle.cages.some(c=>c.cells.length===size)).toBe(true);
    expect(countKillerSolutions(puzzle.cages)).toBe(1);
    expect(puzzle.digging!.removed).toBeGreaterThan(0);
    expect(puzzle.digging!.total).toBe(puzzle.cages.length+puzzle.digging!.removed);
    expect(progress.at(-1)?.tested).toBe(puzzle.digging!.total);
    if(options.digPairs) expect(()=>cageDigGroups(puzzle.cages,true)).not.toThrow();
    if(options.logicOnly) {
      expect(puzzle.logicallySolved).toBe(true);
      expect(puzzle.techniqueTally['Brute Force']).toBeUndefined();
    }
  },180000);
  it('rejects removal of every clue before starting a search', () => {
    expect(retainedCageSizesError({sizes:[1],dig:true,digSingletons:true})).toContain('Allow larger cages');
    expect(()=>generateVerifiedPuzzle({sizes:[1],dig:true,digSingletons:true})).toThrow('Allow larger cages');
    expect(retainedCageSizesError({sizes:[1],dig:false,digSingletons:true})).toBeNull();
  });
});
