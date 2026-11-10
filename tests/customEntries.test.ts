import { expect, it } from 'vitest';
import { customEntryGrid } from '../src/engine/customEntries';
import { generateCustomPuzzle } from '../src/engine/customBuilder';
import { newManualBoard } from '../src/engine/manualPlay';
import { bit, UNITS } from '../src/vendor/sudokui/board';
import { countKillerSolutions } from '../src/engine/digging';
import { applyDeduction, nextKillerStep } from '../src/engine/killerSolver';

const solution = Array.from({length:81},(_,i)=>(Math.floor(i/9)*3+Math.floor(i/27)+i%9)%9+1);
it('retains fixed digits and explicit Snyder possibilities without mutating entries', () => {
  const entries = newManualBoard(); entries.values[0]=1; entries.notes[1]=bit(1)|bit(2)|bit(3);
  const snapshot = JSON.stringify(entries);
  const grid = customEntryGrid(entries);
  expect(grid.values[0]).toBe(1); expect(grid.given[0]).toBe(1);
  expect(grid.cands[1]).toBe(bit(2)|bit(3));
  expect(JSON.stringify(entries)).toBe(snapshot);
});
it('rejects conflicting digits, impossible notations and malformed entries', () => {
  const entries = newManualBoard(); entries.values[0]=1; entries.values[1]=1;
  expect(()=>customEntryGrid(entries)).toThrow('repeat');
  entries.values[1]=0; entries.notes[1]=bit(1);
  expect(()=>customEntryGrid(entries)).toThrow('no valid candidates');
  entries.notes[1]=512;
  expect(()=>customEntryGrid(entries)).toThrow('Invalid');
  entries.notes[1]=0; entries.notes[0]=bit(1);
  expect(()=>customEntryGrid(entries)).toThrow('either a digit');
});
it('uses givens and Snyder possibilities for uniqueness and walkthrough replay', () => {
  const entries = newManualBoard(); entries.values=solution.slice();
  for(let i=0;i<9;i++) entries.values[i]=0;
  entries.notes[0]=bit(solution[0])|bit(9);
  const groups=UNITS.slice(0,9);
  const puzzle=generateCustomPuzzle(groups,{maxAttempts:1},entries);
  expect(puzzle.values).toEqual(solution);
  expect(puzzle.entries).toEqual(entries);
  expect(countKillerSolutions(puzzle.cages)).toBe(2);
  let replay=customEntryGrid(puzzle.entries,groups);
  expect(countKillerSolutions(puzzle.cages,Infinity,undefined,replay)).toBe(1);
  for(const step of puzzle.deductions) replay=applyDeduction(replay,puzzle.cages,step);
  expect(nextKillerStep(replay,puzzle.cages).status).toBe('solved');
  expect(Array.from(replay.values)).toEqual(solution);
});
it('supports numbers without cages, and notation-only restrictions', () => {
  const entries = newManualBoard(); entries.values=solution.slice(); entries.values[0]=0;
  expect(generateCustomPuzzle([],{maxAttempts:1},entries).values).toEqual(solution);
  entries.values.fill(0); entries.notes=solution.map(bit);
  const puzzle=generateCustomPuzzle([],{maxAttempts:1},entries);
  expect(puzzle.values).toEqual(solution);
  expect(puzzle.entries!.notes).toEqual(entries.notes);
});
