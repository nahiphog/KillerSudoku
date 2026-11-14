import { bit, cloneGrid, isBroken, isSolved, setValue, type Grid } from '../vendor/sudokui/board';
import { solve } from '../vendor/sudokui/bruteForce';
import { withHouses, type Step } from '../vendor/sudokui/steps';
import { findFullHouse, findNakedSingle, findHiddenSingle } from '../vendor/sudokui/techniques/singles';
import { findLockedCandidates1, findLockedCandidates2 } from '../vendor/sudokui/techniques/intersections';
import { findNakedSubset, findHiddenSubset } from '../vendor/sudokui/techniques/subsets';
import { findBasicFish } from '../vendor/sudokui/techniques/fish';
import { findEmptyRectangle } from '../vendor/sudokui/techniques/singleDigit';
import { findRemotePair } from '../vendor/sudokui/techniques/chains';
import { findWWing, findXYWing, findXYZWing } from '../vendor/sudokui/techniques/wings';

type Finder = (grid: Grid) => Step | null;
function bruteForce(grid: Grid): Step | null {
  if (isBroken(grid) || isSolved(grid)) return null;
  const solution = solve(grid);
  if (!solution) return null;
  const cell = grid.values.findIndex(value => value === 0);
  return { tech: 'BRUTE_FORCE', placements: [{ cell, digit: solution.values[cell] }],
    eliminations: [], description: 'Brute Force: place a digit from a solution found by backtracking.' };
}

/** Exactly the requested techniques, in the requested order. */
export const TECHNIQUES: readonly { id: string; name: string; find: Finder }[] = [
  { id: 'FULL_HOUSE', name: 'Full House', find: findFullHouse },
  { id: 'NAKED_SINGLE', name: 'Naked Single', find: findNakedSingle },
  { id: 'HIDDEN_SINGLE', name: 'Hidden Single', find: findHiddenSingle },
  { id: 'LOCKED_CANDIDATES_1', name: 'Locked Candidates (Pointing)', find: findLockedCandidates1 },
  { id: 'LOCKED_CANDIDATES_2', name: 'Locked Candidates (Claiming)', find: findLockedCandidates2 },
  { id: 'NAKED_PAIR', name: 'Naked Pair', find: g => findNakedSubset(g, 2, undefined) },
  { id: 'HIDDEN_PAIR', name: 'Hidden Pair', find: g => findHiddenSubset(g, 2) },
  { id: 'NAKED_TRIPLE', name: 'Naked Triple', find: g => findNakedSubset(g, 3, undefined) },
  { id: 'HIDDEN_TRIPLE', name: 'Hidden Triple', find: g => findHiddenSubset(g, 3) },
  { id: 'NAKED_QUADRUPLE', name: 'Naked Quadruple', find: g => findNakedSubset(g, 4, false) },
  { id: 'X_WING', name: 'X-Wing', find: g => findBasicFish(g, 2) },
  { id: 'HIDDEN_QUADRUPLE', name: 'Hidden Quadruple', find: g => findHiddenSubset(g, 4) },
  { id: 'SWORDFISH', name: 'Swordfish', find: g => findBasicFish(g, 3) },
  { id: 'JELLYFISH', name: 'Jellyfish', find: g => findBasicFish(g, 4) },
  { id: 'EMPTY_RECTANGLE', name: 'Empty Rectangle', find: findEmptyRectangle },
  { id: 'REMOTE_PAIR', name: 'Remote Pairs', find: findRemotePair },
  { id: 'W_WING', name: 'W-Wing', find: findWWing },
  { id: 'XY_WING', name: 'XY-Wing', find: findXYWing },
  { id: 'XYZ_WING', name: 'XYZ-Wing', find: findXYZWing },
  { id: 'BRUTE_FORCE', name: 'Brute Force', find: bruteForce },
];

export function findNextStep(grid: Grid, allowBruteForce = false, order = TECHNIQUES): Step | null {
  if (isBroken(grid) || isSolved(grid)) return null;
  for (const technique of order) {
    if (technique.id === 'BRUTE_FORCE' && !allowBruteForce) continue;
    const step = technique.find(grid);
    if (step) return withHouses(step, grid);
  }
  return null;
}

/** Returns a new board, preserving the input for history/undo. */
export function applyStep(grid: Grid, step: Step): Grid {
  const next = cloneGrid(grid);
  for (const { cell, digit } of step.placements) setValue(next, cell, digit);
  for (const { cell, digit } of step.eliminations) next.cands[cell] &= ~bit(digit);
  return next;
}

export { solve, countSolutions } from '../vendor/sudokui/bruteForce';
export { parseGrid, gridFromValues } from '../vendor/sudokui/board';
export type { Grid, Step };
