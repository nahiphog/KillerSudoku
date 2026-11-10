import { bit, emptyGrid, isBroken, setValue, UNITS, type Grid } from '../vendor/sudokui/board';
import type { ManualBoard } from './manualPlay';

/** Zero notes means unrestricted; otherwise every allowed digit is explicitly marked. */
export function customEntryGrid(entries?: ManualBoard, groups: number[][] = []): Grid {
  const grid = emptyGrid();
  if (!entries) return grid;
  if (entries.values.length !== 81 || entries.notes.length !== 81
    || entries.values.some(v => !Number.isInteger(v) || v < 0 || v > 9)
    || entries.notes.some(v => !Number.isInteger(v) || v < 0 || v > 511)) throw new Error('Invalid cell entries.');
  for (let cell = 0; cell < 81; cell++) {
    if (entries.values[cell] && entries.notes[cell]) throw new Error('A cell must contain either a digit or Snyder notations, not both.');
    if (entries.notes[cell]) grid.cands[cell] = entries.notes[cell];
  }
  for (let cell = 0; cell < 81; cell++) if (entries.values[cell]) {
    setValue(grid, cell, entries.values[cell]); grid.given[cell] = 1;
  }
  for (const group of [...UNITS, ...groups]) {
    const values = group.map(cell => grid.values[cell]).filter(Boolean);
    if (new Set(values).size !== values.length) throw new Error('Entered digits repeat in a row, column, box or cage.');
    const used = values.reduce((mask, digit) => mask | bit(digit), 0);
    for (const cell of group) if (!grid.values[cell]) grid.cands[cell] &= ~used;
  }
  if (isBroken(grid)) throw new Error('The entered digits and Snyder notations leave no valid candidates.');
  return grid;
}
