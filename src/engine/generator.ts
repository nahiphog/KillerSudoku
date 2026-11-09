import { cloneGrid, digitsOf, emptyGrid, setValue, type Grid } from '../vendor/sudokui/board';

/** Randomized backtracking, exploring candidates in a fresh random order. */
export function generateFullGrid(random: () => number = Math.random): Grid {
  function fill(grid: Grid): Grid | null {
    let cell = -1;
    let choices: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (grid.values[i]) continue;
      const candidates = digitsOf(grid.cands[i]);
      if (!candidates.length) return null;
      if (cell === -1 || candidates.length < choices.length) {
        cell = i;
        choices = candidates;
        if (choices.length === 1) break;
      }
    }
    if (cell === -1) return grid;
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    for (const digit of choices) {
      const next = cloneGrid(grid);
      setValue(next, cell, digit);
      const result = fill(next);
      if (result) return result;
    }
    return null;
  }
  const result = fill(emptyGrid());
  if (!result) throw new Error('Unable to generate a completed grid.');
  return result;
}
