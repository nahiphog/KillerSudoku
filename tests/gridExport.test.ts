import { expect, it } from 'vitest';
import { serializeGrid } from '../src/gridExport';

it('serializes cage sums and exact one-based coordinates including uncovered cells', () => {
  const values=Array(81).fill(0);values[80]=9;
  const notes: number[][]=Array.from({length:81},()=>[]);notes[1]=[2,4];
  const cages=[{cells:[9,0],sum:8},{cells:[79,80],sum:12}];
  const data=JSON.parse(serializeGrid({values,notes,cages,cageFreeCells:[40]}));
  expect(data.format).toBe('killer-sudoku');expect(data.version).toBe(1);
  expect(data.digits).toBe('0'.repeat(80)+'9');
  expect(data.cages).toEqual([{sum:8,cells:['R1C1','R2C1']},{sum:12,cells:['R9C8','R9C9']}]);
  expect(data.notes).toEqual({R1C2:[2,4]});
  expect(data.uncagedCells).toHaveLength(77);expect(data.uncagedCells).toContain('R5C5');
  expect(data.uncagedCells).not.toContain('R1C1');expect(data.cageFreeCells).toEqual(['R5C5']);
  expect(cages[0].cells).toEqual([9,0]);
});

it('preserves unknown draft sums instead of fabricating clues', () => {
  const data=JSON.parse(serializeGrid({values:Array(81).fill(0),notes:Array.from({length:81},()=>[]),cages:[{cells:[0,1],sum:null}]}));
  expect(data.cages).toEqual([{sum:null,cells:['R1C1','R1C2']}]);
  expect(data.digits).toBe('0'.repeat(81));
});
