import { expect, it } from 'vitest';
import { traceLogically } from '../src/engine/verifiedGenerator';
import { nextKillerStep, startSolver } from '../src/engine/killerSolver';
import { bit, setValue } from '../src/vendor/sudokui/board';
import { findNakedSubset } from '../src/vendor/sudokui/techniques/subsets';
import type { Cage } from '../src/engine/cages';
const cages:Cage[]=[
  [3,[0,1]],[13,[2,3]],[15,[4,5]],[11,[6,7]],
  [7,[12,13]],[8,[14,15]],[5,[16,25]],[3,[21,22]],
  [7,[27,36]],[13,[30,39]],[15,[34,42,43]],[24,[37,38,46]],
  [3,[41,50]],[12,[44,53]],[10,[55,64]],[6,[58,59]],
  [13,[65,66]],[17,[67,68]],[6,[73,74]],[11,[75,76]],
  [10,[77,78]],[9,[79,80]],
].map(([sum,cells])=>({sum:sum as number,cells:cells as number[]}));

it('uses the R2C4/R2C5 naked pair at step 37 of the reported puzzle',()=>{
  const trace=traceLogically(cages)!;
  const step=trace.deductions[36];
  expect(step.technique).toBe('Naked Pair');
  expect(step.supportDigits).toEqual([
    {cell:12,digit:3},{cell:12,digit:4},{cell:13,digit:3},{cell:13,digit:4},
  ]);
  expect(step.eliminations).toEqual(expect.arrayContaining([
    {cell:9,digit:3},{cell:9,digit:4}, // Row 2 outside box 2.
    {cell:3,digit:4},{cell:23,digit:3}, // Box 2 outside row 2.
  ]));
  expect(trace.complete).toBe(true);
  expect(trace.deductions.some(step=>step.technique==='Brute Force')).toBe(false);
});

it.each(['sum','product','mixed','psycho'] as const)(
  'finds intersecting naked pairs through the %s cage solver', mode=>{
    const grid=startSolver();
    grid.cands[12]=grid.cands[13]=bit(3)|bit(4);
    const layout:Cage[]=[{cells:[12,13],sum:mode==='product'?12:7,
      operation:mode==='mixed'?'sum':mode}];
    if(mode==='mixed'){
      setValue(grid,0,9);
      layout.push({cells:[0],sum:9,operation:'product'});
    }
    const result=nextKillerStep(grid,layout);
    expect(result.status).toBe('step');
    if(result.status!=='step')throw new Error('Expected a deduction');
    expect(result.step.technique).toBe('Naked Pair');
    expect(result.step.eliminations).toEqual(expect.arrayContaining([
      {cell:9,digit:3},{cell:9,digit:4},{cell:3,digit:3},{cell:3,digit:4},
    ]));
  },
);

it('also includes intersecting triples without duplicate eliminations',()=>{
  const grid=startSolver();
  grid.cands[0]=bit(1)|bit(2);
  grid.cands[1]=bit(2)|bit(3);
  grid.cands[2]=bit(1)|bit(3);
  const step=findNakedSubset(grid,3,undefined)!;
  expect(step.tech).toBe('NAKED_TRIPLE');
  expect(step.eliminations).toEqual(expect.arrayContaining([
    {cell:3,digit:1},{cell:9,digit:3},
  ]));
  expect(new Set(step.eliminations.map(({cell,digit})=>`${cell}-${digit}`)).size)
    .toBe(step.eliminations.length);
});
