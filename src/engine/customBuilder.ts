import { customEntryGrid } from './customEntries';
import type { ManualBoard } from './manualPlay';
import { bit, cloneGrid, digitsOf, emptyGrid, setValue, type Grid } from '../vendor/sudokui/board';
import { orthogonalNeighbors, type Cage } from './cages';
import { countKillerSolutions } from './digging';
import { traceLogically, type GenerationLimits, type VerifiedPuzzle } from './verifiedGenerator';

export function cageFreeCellsError(groups: number[][], cageFreeCells: readonly number[]): string | null {
  if(cageFreeCells.some(cell => !Number.isInteger(cell) || cell < 0 || cell > 80)) return 'Invalid cage-free cell.';
  if(groups.some(group => group.some(cell => cageFreeCells.includes(cell)))) return 'Tagged cage-free cells cannot belong to a cage. Remove the cage or untag the cell first.';
  return null;
}

export function customLayoutError(groups: number[][], cageFreeCells: readonly number[] = []): string | null {
  const blockedError = cageFreeCellsError(groups, cageFreeCells);
  if(blockedError) return blockedError;
  if (!groups.length) return 'Add at least one cage.';
  const occupied = new Set<number>();
  for (const cells of groups) {
    if (!cells.length || cells.length > 9) return 'Each cage must contain 1–9 cells.';
    for (const cell of cells) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 80) return 'Invalid cell in cage.';
      if (occupied.has(cell)) return 'Cages cannot overlap or repeat a cell.';
      occupied.add(cell);
    }
    const reached = new Set([cells[0]]);
    for (const cell of reached) for (const neighbor of orthogonalNeighbors(cell)) {
      if (cells.includes(neighbor)) reached.add(neighbor);
    }
    if (reached.size !== cells.length) return 'Cage cells must connect along their edges.';
  }
  return null;
}

/** Build with the layout's all-different constraints, rather than discarding
 * ordinary Sudoku grids whenever a cage happens to repeat a digit. */
function fillLayout(groups: number[][], random: () => number, deadline: number, initial: Grid): Grid | null {
  const groupFor = new Map<number, number[]>();
  for (const group of groups) for (const cell of group) groupFor.set(cell, group);
  let budget = 100000;
  function fill(grid: Grid): Grid | null {
    if (Date.now() >= deadline || --budget < 0) return null;
    let target = -1;
    let choices: number[] = [];
    for (let cell = 0; cell < 81; cell++) if (!grid.values[cell]) {
      let mask = grid.cands[cell];
      for (const peer of groupFor.get(cell) ?? []) if (grid.values[peer]) mask &= ~bit(grid.values[peer]);
      const candidates = digitsOf(mask);
      if (!candidates.length) return null;
      if (target < 0 || candidates.length < choices.length) { target = cell; choices = candidates; }
    }
    if (target < 0) return grid;
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    for (const digit of choices) {
      const next = cloneGrid(grid); setValue(next, target, digit);
      const result = fill(next);
      if (result) return result;
    }
    return null;
  }
  return fill(cloneGrid(initial));
}

export function generateCustomPuzzle(groups: number[][], limits: GenerationLimits = {}, entries?: ManualBoard, cageFreeCells: readonly number[] = []): VerifiedPuzzle {
  const hasEntries = entries?.values.some(Boolean) || entries?.notes.some(Boolean);
  const error = cageFreeCellsError(groups, cageFreeCells) ?? (groups.length || !hasEntries ? customLayoutError(groups) : null);
  if (error) throw new Error(error);
  if (!hasEntries && groups.every(group => group.length === 9)) throw new Error('Nine-cell cages always sum to 45. This layout cannot specify a unique solution. Add smaller cages.');
  const initial = customEntryGrid(entries, groups);
  const started = performance.now();
  const deadline = Date.now() + (limits.maxMilliseconds ?? 45000);
  for (let attempt = 1; attempt <= (limits.maxAttempts ?? 1500) && Date.now() < deadline; attempt++) {
    limits.onProgress?.(attempt);
    const grid = fillLayout(groups, limits.random ?? Math.random, deadline, initial);
    if (!grid) continue;
    const values = Array.from(grid.values);
    const cages: Cage[] = groups.map(cells => ({ cells: [...cells].sort((a, b) => a - b), sum: cells.reduce((sum, cell) => sum + values[cell], 0) }));
    // A difficult candidate must not consume the entire search allowance.
    let count: number;
    try { count = countKillerSolutions(cages, Math.min(deadline, Date.now() + 2000), values, initial); }
    catch { continue; }
    if (count !== 1) continue;
    const proof = traceLogically(cages, deadline, true, initial);
    return { values, cages, cageFreeCells: [...new Set(cageFreeCells)], entries: entries ? { values: [...entries.values], notes: [...entries.notes] } : undefined, attempts: attempt, logicallySolved: !!proof?.complete && !proof.techniqueTally['Brute Force'],
      deductions: proof?.deductions ?? [], techniqueTally: proof?.techniqueTally ?? {},
      proofSteps: proof?.steps ?? 0, difficulty: proof?.difficulty ?? 'Easy',
      hardestTechnique: proof?.hardestTechnique ?? 'Not rated', elapsedMilliseconds: performance.now() - started };
  }
  throw new Error('No unique puzzle was found within this search. Try again, or split larger cages / add more cages. Your layout is unchanged; this does not prove it is impossible.');
}
