import { expect, it } from 'vitest';
import { bit, emptyGrid, setValue } from '../src/vendor/sudokui/board';
import { findPhistomefelRing, PHISTOMEFEL_CORNERS as corners, PHISTOMEFEL_RING as ring } from '../src/engine/phistomefelRing';
import { applyDeduction, nextKillerStep } from '../src/engine/killerSolver';
import { traceLogically } from '../src/engine/verifiedGenerator';
import { techniqueDifficulty } from '../src/engine/difficulty';
import { scoredTally } from '../src/engine/techniqueScores';
import { generateFullGrid } from '../src/engine/generator';

const rng = (seed:number) => () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

it('uses exactly the specified ring and corner cells',()=>{
  const names=(cells:number[])=>cells.map(cell=>`R${Math.floor(cell/9)+1}C${cell%9+1}`);
  expect(names(ring).join(',')).toBe('R3C3,R3C4,R3C5,R3C6,R3C7,R4C3,R4C7,R5C3,R5C7,R6C3,R6C7,R7C3,R7C4,R7C5,R7C6,R7C7');
  expect(names(corners).join(',')).toBe('R1C1,R1C2,R1C8,R1C9,R2C1,R2C2,R2C8,R2C9,R8C1,R8C2,R8C8,R8C9,R9C1,R9C2,R9C8,R9C9');
});

it.each([false,true])('eliminates an absent digit in either direction (reverse=%s)',reverse=>{
  const grid=emptyGrid();const source=reverse?corners:ring,target=reverse?ring:corners;
  for(const cell of source)grid.cands[cell]&=~bit(9);
  const step=findPhistomefelRing(grid)!;
  expect(step.technique).toBe('Phistomefel Ring');
  expect(step.eliminations).toEqual(target.map(cell=>({cell,digit:9})));
  expect(step.placements).toEqual([]);
  expect(step.description).toContain('common count must be 0');
  expect(step.supportCells).toEqual([...ring,...corners]);
  const next=applyDeduction(grid,[],step);
  for(const cell of target){expect(next.cands[cell]&bit(9)).toBe(0);expect(grid.cands[cell]&bit(9)).not.toBe(0);}
  expect(findPhistomefelRing(next)).toBeNull();
});

it.each([false,true])('places every required occurrence, preserving multiplicity (reverse=%s)',reverse=>{
  const solution=generateFullGrid(rng(4)).values;
  const source=reverse?corners:ring,target=reverse?ring:corners;
  const digit=Array.from({length:9},(_,i)=>i+1).sort((a,b)=>source.filter(c=>solution[c]===b).length-source.filter(c=>solution[c]===a).length)[0];
  const grid=emptyGrid();
  for(const cell of source)grid.cands[cell]=solution[cell]===digit?bit(digit):grid.cands[cell]&~bit(digit);
  for(const cell of target)if(solution[cell]!==digit)grid.cands[cell]&=~bit(digit);
  const step=findPhistomefelRing(grid)!;
  const expected=target.filter(cell=>solution[cell]===digit);
  expect(expected.length).toBeGreaterThan(1);
  expect(step.placements).toEqual(expected.map(cell=>({cell,digit})));
  expect(step.eliminations).toEqual([]);
  expect(step.description).toContain('every remaining position');
});

it('makes no claim when the counts remain undetermined',()=>{
  expect(findPhistomefelRing(emptyGrid())).toBeNull();
});

it('runs in the shared walkthrough before harder techniques and without brute force',()=>{
  const grid=emptyGrid();
  for(const cell of ring)grid.cands[cell]&=~bit(9);
  const result=nextKillerStep(grid,[]);
  expect(result.status).toBe('step');
  if(result.status==='step')expect(result.step.technique).toBe('Phistomefel Ring');
  const trace=traceLogically([],Infinity,false,grid)!;
  expect(trace.techniqueTally['Phistomefel Ring']).toBe(1);
  expect(trace.techniqueTally['Brute Force']).toBeUndefined();
  expect(trace.hardestTechnique).toBe('Phistomefel Ring');
});

it('never removes a true digit or places a false one on compatible candidate boards',()=>{
  const random=rng(37);let deductions=0;
  for(let sample=0;sample<120;sample++){
    const solution=generateFullGrid(random).values;
    const tally=(cells:number[])=>Array.from({length:9},(_,i)=>cells.filter(c=>solution[c]===i+1).length);
    expect(tally(ring)).toEqual(tally(corners));
    const grid=emptyGrid();
    for(let cell=0;cell<81;cell++)if(random()<0.2)setValue(grid,cell,solution[cell]);
    for(let cell=0;cell<81;cell++)if(!grid.values[cell])for(let digit=1;digit<=9;digit++)if(digit!==solution[cell]&&random()<0.8)grid.cands[cell]&=~bit(digit);
    const step=findPhistomefelRing(grid);
    if(!step)continue;
    deductions++;
    for(const item of step.placements)expect(item.digit).toBe(solution[item.cell]);
    for(const item of step.eliminations)expect(item.digit).not.toBe(solution[item.cell]);
  }
  expect(deductions).toBeGreaterThan(0);
});

it('adds 200 for each instance and participates in hardest-technique classification',()=>{
  expect(scoredTally({'Phistomefel Ring':3})).toEqual([{technique:'Phistomefel Ring',count:3,rating:200,score:600}]);
  expect(techniqueDifficulty('Phistomefel Ring')).toBe('Hard');
});
