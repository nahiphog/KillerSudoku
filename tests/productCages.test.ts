import { expect, it } from 'vitest';
import { combinationTable } from '../src/engine/combinations';
import { applyDeduction, cageSupports, nextKillerStep, startSolver } from '../src/engine/killerSolver';
import { generateVerifiedPuzzle } from '../src/engine/verifiedGenerator';
import { countKillerSolutions } from '../src/engine/digging';
import { setValue } from '../src/vendor/sudokui/board';
import { serializeGrid } from '../src/gridExport';
import { importGridString, parseGridString } from '../src/engine/gridImport';
import { generateCustomPuzzle } from '../src/engine/customBuilder';

const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
it('enumerates distinct product sets, including collisions and large targets',()=>{
  expect(combinationTable(2,'product').find(row=>row.sum===6)?.combinations).toEqual([[1,6],[2,3]]);
  expect(combinationTable(2,'product').find(row=>row.sum===4)?.combinations).toEqual([[1,4]]);
  expect(combinationTable(9,'product')).toEqual([{sum:362880,combinations:[[1,2,3,4,5,6,7,8,9]]}]);
});
it('uses division for product remainders and forbids repeated digits',()=>{
  const grid=startSolver();setValue(grid,0,3);setValue(grid,1,4);
  const cage={cells:[0,1,2],sum:24,operation:'product' as const};
  const result=nextKillerStep(grid,[cage]);
  expect(result.status).toBe('step');
  if(result.status==='step') {expect(result.step.placements).toEqual([{cell:2,digit:2}]);expect(result.step.description).toContain('24 ÷ 12 = 2');}
  const repeats=startSolver();setValue(repeats,0,2);setValue(repeats,40,2);
  expect(cageSupports(repeats,{cells:[0,40],sum:4,operation:'product'}).combinations).toEqual([]);
});
it('generates and digs product cages with uniqueness and a complete logical replay',()=>{
  const puzzle=generateVerifiedPuzzle({operation:'product',sizes:[2,3],dig:true},{random:rng(1)});
  expect(puzzle.logicallySolved).toBe(true);
  for(const cage of puzzle.cages) {
    expect(cage.operation).toBe('product');
    expect(cage.cells.reduce((product,cell)=>product*puzzle.values[cell],1)).toBe(cage.sum);
    expect(new Set(cage.cells.map(cell=>puzzle.values[cell])).size).toBe(cage.cells.length);
  }
  expect(countKillerSolutions(puzzle.cages)).toBe(1);
  let grid=startSolver();for(const step of puzzle.deductions) grid=applyDeduction(grid,puzzle.cages,step);
  expect(Array.from(grid.values)).toEqual(puzzle.values);
},180000);
it('round trips mixed arithmetic and custom product generation without changing targets',()=>{
  const groups=[[0,1],...Array.from({length:79},(_,i)=>[i+2])];
  const puzzle=generateCustomPuzzle(groups,{random:rng(4),maxAttempts:1},undefined,[],['product']);
  expect(puzzle.cages[0].operation).toBe('product');
  const text=serializeGrid({cages:puzzle.cages,values:Array(81).fill(0),notes:Array.from({length:81},()=>[])});
  expect(JSON.parse(text).cages[0].product).toBe(puzzle.cages[0].sum);
  expect(parseGridString(text).cages).toEqual(puzzle.cages);
  expect(importGridString(text).values).toEqual(puzzle.values);
  const invalid=JSON.parse(text);invalid.cages[0].product=13;
  expect(()=>parseGridString(JSON.stringify(invalid))).toThrow('target');
});
