import { expect, it } from 'vitest';
import { applyDeduction, psychoOperationSteps, revealedCageOperations, startSolver } from '../src/engine/killerSolver';
import { generateVerifiedPuzzle } from '../src/engine/verifiedGenerator';
import { bit, setValue } from '../src/vendor/sudokui/board';
import { importGridString } from '../src/engine/gridImport';
import { serializeGrid } from '../src/gridExport';
import { scoredTally } from '../src/engine/techniqueScores';
import type { Cage } from '../src/engine/cages';
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

it('explains an operation forced by the distinct-digit tables alone',()=>{
  const steps=psychoOperationSteps(startSolver(),[{cells:[0,1],sum:40,operation:'psycho'},{cells:[2,3],sum:17,operation:'psycho'}],new Set());
  expect(steps.map(step=>step.cageOperation?.operation)).toEqual(['product','sum']);
  expect(steps[0].description).toContain('no set of 2 distinct digits');
  expect(steps[0].description).toContain('{5, 8}');
  expect(steps[1].description).toContain('product is impossible');
});
it('waits until the alternative has no assignment and explains the current evidence',()=>{
  const cage:Cage={cells:[0,1],sum:6,operation:'psycho'};
  const grid=startSolver();setValue(grid,0,2);
  expect(psychoOperationSteps(grid,[cage],new Set())).toEqual([]);
  grid.cands[1]=bit(3);
  const steps=psychoOperationSteps(grid,[cage],new Set());
  expect(steps).toHaveLength(1);
  expect(steps[0].cageOperation).toEqual({cell:0,operation:'product'});
  expect(steps[0].description).toContain('r1c1 = 2');
  expect(steps[0].description).toContain('r1c2 candidates {3}');
  expect(steps[0].description).toContain('None can be assigned');
  expect(psychoOperationSteps(grid,[cage],new Set([0]))).toEqual([]);
  expect(revealedCageOperations(steps,0).size).toBe(0);
  expect(revealedCageOperations(steps,1).get(0)).toBe('product');
  expect(revealedCageOperations(steps,0).size).toBe(0);
  expect(Array.from(applyDeduction(grid,[cage],steps[0]).values)).toEqual(Array.from(grid.values));
});
it('does not invent an operation when both fit, including fully filled cages and singletons',()=>{
  const grid=startSolver();setValue(grid,0,1);setValue(grid,1,2);setValue(grid,2,3);
  expect(psychoOperationSteps(grid,[{cells:[0,1,2],sum:6,operation:'psycho'},{cells:[2],sum:3,operation:'psycho'}],new Set())).toEqual([]);
});
it('records each discovery once, replays it, and reproduces it in imported walkthroughs without adding difficulty',()=>{
  const puzzle=generateVerifiedPuzzle({operation:'psycho',sizes:[2,3],dig:true},{random:rng(3)});
  const discoveries=puzzle.deductions.filter(step=>step.cageOperation);
  expect(discoveries.length).toBeGreaterThan(0);
  expect(new Set(discoveries.map(step=>step.cageOperation!.cell)).size).toBe(discoveries.length);
  expect(puzzle.proofSteps).toBe(puzzle.deductions.length);
  expect(puzzle.techniqueTally['Cage operation']).toBe(discoveries.length);
  expect(scoredTally({'Cage operation':discoveries.length})[0].score).toBe(0);
  let grid=startSolver();const revealed=new Set<number>();
  for(const step of puzzle.deductions){
    if(step.cageOperation){
      expect(psychoOperationSteps(grid,puzzle.cages,revealed)).toContainEqual(step);
      revealed.add(step.cageOperation.cell);
    }
    grid=applyDeduction(grid,puzzle.cages,step);
  }
  expect(Array.from(grid.values)).toEqual(puzzle.values);
  const text=serializeGrid({cages:puzzle.cages,values:Array(81).fill(0),notes:Array.from({length:81},()=>[])});
  expect(importGridString(text).deductions).toEqual(puzzle.deductions);
},120000);
