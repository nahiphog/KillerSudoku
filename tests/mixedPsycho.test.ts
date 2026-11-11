import { expect, it } from 'vitest';
import { combinationTable } from '../src/engine/combinations';
import { cageSymbol, type Cage } from '../src/engine/cages';
import { cageSupports, nextKillerStep, startSolver, applyDeduction } from '../src/engine/killerSolver';
import { generateVerifiedPuzzle } from '../src/engine/verifiedGenerator';
import { generateFullGrid } from '../src/engine/generator';
import { countKillerSolutions, cageDigGroups } from '../src/engine/digging';
import { setValue, digitsOf } from '../src/vendor/sudokui/board';
import { serializeGrid } from '../src/gridExport';
import { importGridString, parseGridString } from '../src/engine/gridImport';
import { manualStatus, newManualBoard } from '../src/engine/manualPlay';
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

it('unions sum and product combinations and does not double-count identical sets',()=>{
  expect(combinationTable(2,'psycho').find(row=>row.sum===6)?.combinations).toEqual([[1,5],[2,4],[1,6],[2,3]]);
  expect(combinationTable(3,'psycho').find(row=>row.sum===6)?.combinations).toEqual([[1,2,3]]);
  expect(cageSymbol('psycho')).toBe('');expect(cageSymbol('product')).toBe('×');expect(cageSymbol()).toBe('+');
});
it('does not force a sum remainder when a product remainder is also possible',()=>{
  const grid=startSolver();setValue(grid,0,2);
  const cage:Cage={cells:[0,1],sum:6,operation:'psycho'};
  expect(digitsOf(cageSupports(grid,cage).supports[1])).toEqual([3,4]);
  const result=nextKillerStep(grid,[cage]);expect(result.status).toBe('step');
  if(result.status==='step'){
    expect(result.step.placements).toEqual([]);
    expect(result.step.description).toContain('Both operations');
    expect(result.step.eliminations.some(e=>e.cell===1&&(e.digit===3||e.digit===4))).toBe(false);
  }
  const board=newManualBoard();board.values[0]=2;board.values[1]=3;
  expect(manualStatus(board,[cage]).conflicts.size).toBe(0);
  board.values[1]=4;expect(manualStatus(board,[cage]).conflicts.size).toBe(0);
  board.values[1]=2;expect(manualStatus(board,[cage]).conflicts.size).toBeGreaterThan(0);
});
it('certifies Psycho uniqueness across both arithmetic interpretations, not a hidden operator',()=>{
  const solution=generateFullGrid(rng(3));const initial=startSolver();
  for(let i=0;i<81;i++)if(solution.values[i]!==3&&solution.values[i]!==4)setValue(initial,i,solution.values[i]);
  const cells=[Array.from(solution.values).indexOf(3),Array.from(solution.values).indexOf(2)];
  expect(countKillerSolutions([{cells,sum:6,operation:'sum'}],Infinity,undefined,initial)).toBe(1);
  expect(countKillerSolutions([{cells,sum:6,operation:'product'}],Infinity,undefined,initial)).toBe(1);
  expect(countKillerSolutions([{cells,sum:6,operation:'psycho'}],Infinity,undefined,initial)).toBe(2);
});
it.each([true,false])('retains both marked operations after mixed paired digging, logic-only=%s',logicOnly=>{
  const puzzle=generateVerifiedPuzzle({operation:'mixed',sizes:[1,2,3],retainedCageSizes:[1,2,3],digSingletons:true,dig:true,digPairs:true,logicOnly},{random:rng(3)});
  expect(puzzle.cages.some(c=>(c.operation??'sum')==='sum')).toBe(true);
  expect(puzzle.cages.some(c=>c.operation==='product')).toBe(true);
  expect(puzzle.cages.every(c=>c.cells.length>1)).toBe(true);
  expect(()=>cageDigGroups(puzzle.cages,true)).not.toThrow();
  expect(countKillerSolutions(puzzle.cages)).toBe(1);
},180000);
it('generates, digs, replays and round-trips a Psycho puzzle without exposing hidden operations',()=>{
  const puzzle=generateVerifiedPuzzle({operation:'psycho',sizes:[2,3],dig:true,logicOnly:true},{random:rng(3)});
  expect(puzzle.cages.every(c=>c.operation==='psycho')).toBe(true);
  expect(countKillerSolutions(puzzle.cages)).toBe(1);
  let grid=startSolver();for(const step of puzzle.deductions)grid=applyDeduction(grid,puzzle.cages,step);
  expect(Array.from(grid.values)).toEqual(puzzle.values);
  const text=serializeGrid({cages:puzzle.cages,values:Array(81).fill(0),notes:Array.from({length:81},()=>[])});
  expect(JSON.parse(text).cages.every((c:Record<string,unknown>)=>c.operation==='psycho'&&typeof c.target==='number'&&!('product'in c)&&!('sum'in c))).toBe(true);
  expect(parseGridString(text).cages).toEqual(puzzle.cages);
  expect(importGridString(text).deductions).toEqual(puzzle.deductions);
},180000);
