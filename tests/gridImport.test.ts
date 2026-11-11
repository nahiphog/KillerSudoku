import { expect, it } from 'vitest';
import { serializeGrid } from '../src/gridExport';
import { importGridString, parseGridString } from '../src/engine/gridImport';
import { customEntryGrid } from '../src/engine/customEntries';
import { applyDeduction, nextKillerStep } from '../src/engine/killerSolver';

const solution=Array.from({length:81},(_,i)=>(Math.floor(i/9)*3+Math.floor(i/27)+i%9)%9+1);
function fixture() {
  const values=Array(81).fill(0);values[0]=1;
  const notes:number[][]=Array.from({length:81},()=>[]);notes[1]=[2,3];
  return {values,notes,cages:solution.slice(0,80).map((sum,cell)=>({sum,cells:[cell]})),cageFreeCells:[80]};
}
it('round trips cage sums, positions, digits, exact Snyder marks and cage-free cells',()=>{
  const source=fixture(), text=serializeGrid(source), parsed=parseGridString(text);
  expect(parsed.cages).toEqual(source.cages);
  expect(parsed.entries.values).toEqual(source.values);
  expect(parsed.entries.notes[1]).toBe(6);
  expect(parsed.cageFreeCells).toEqual([80]);
  const imported=importGridString(text);
  expect(imported.entries).toEqual(parsed.entries);
  expect(imported.values).toEqual(solution);
  expect(imported.proofSteps).toBeGreaterThan(0);
  let grid=customEntryGrid(imported.entries,imported.cages.map(c=>c.cells));
  expect(Array.from(grid.values)).toEqual(source.values);
  for(const step of imported.deductions) grid=applyDeduction(grid,imported.cages,step);
  expect(nextKillerStep(grid,imported.cages).status).toBe('solved');
  expect(Array.from(grid.values)).toEqual(solution);
});
it('accepts solved grids with a zero-step walkthrough',()=>{
  const source=fixture();source.values=solution;source.notes=Array.from({length:81},()=>[]);
  const puzzle=importGridString(serializeGrid(source));
  expect(puzzle.proofSteps).toBe(0);expect(puzzle.hardestTechnique).toBe('None (already solved)');
});
it('rejects malformed formats, invalid sums, overlaps and inconsistent uncaged lists',()=>{
  const original=JSON.parse(serializeGrid(fixture()));
  for(const patch of [{version:2},{digits:'123'}, {notes:{R1C2:[0]}}, {uncagedCells:[]}, {cageFreeCells:['R1C1']},
    {cages:[{cells:['R1C1'],sum:null}]},{cages:[{cells:['R1C1'],sum:45}]},
    {cages:[{cells:['R1C1','R1C1'],sum:3}]},{cages:[{cells:['R1C1','R2C2'],sum:3}]}]) {
    expect(()=>parseGridString(JSON.stringify({...original,...patch}))).toThrow();
  }
  expect(()=>parseGridString('not json')).toThrow('Paste');
});
it('does not invent a walkthrough for ambiguous or contradictory grids',()=>{
  const source=fixture();
  expect(()=>importGridString(serializeGrid({...source,cages:[],cageFreeCells:[]}))).toThrow('multiple solutions');
  source.cages[1].sum=1;
  expect(()=>importGridString(serializeGrid(source))).toThrow('no solution');
});
