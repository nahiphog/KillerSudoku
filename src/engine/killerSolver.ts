import { bit, cloneGrid, digitsOf, emptyGrid, isBroken, isSolved, setValue, UNITS, cellName, type Grid } from '../vendor/sudokui/board';
import { findNextStep, TECHNIQUES } from './solver';
import { combinationTable } from './combinations';
import type { Cage } from './cages';
import { techniqueRank } from './difficulty';
import { deductionLinks } from './deductionLinks';
import type { ChainLink } from '../vendor/sudokui/steps';

export interface Deduction {
  technique: string;
  description: string;
  placements: { cell: number; digit: number }[];
  eliminations: { cell: number; digit: number }[];
  cells: number[];
  supportCells: number[];
  supportDigits: { cell: number; digit: number }[];
  links?: ChainLink[];
}
export type SolverResult =
  | { status: 'step'; step: Deduction }
  | { status: 'solved' | 'stalled' | 'contradiction'; message: string };

const tables = new Map(Array.from({ length: 8 }, (_, i) => [i + 2, combinationTable(i + 2)]));
// Custom layouts may use a single-cell cage, whose sum fixes its digit.
tables.set(1, Array.from({ length: 9 }, (_, i) => ({ sum: i + 1, combinations: [[i + 1]] })));
const productTables = new Map(Array.from({length:8},(_,i)=>[i+2,combinationTable(i+2,'product')]));
productTables.set(1,tables.get(1)!);
const psychoTables = new Map(Array.from({length:8},(_,i)=>[i+2,combinationTable(i+2,'psycho')]));
psychoTables.set(1,tables.get(1)!);
export const startSolver = (): Grid => emptyGrid();
// Exhaust easier bands before trying a harder deduction, for meaningful ratings.
const logicalOrder = TECHNIQUES.filter(t => t.id !== 'BRUTE_FORCE')
  .slice().sort((a, b) => techniqueRank(a.name) - techniqueRank(b.name));

/** Perfect matching: can each cage cell take a different digit from this set?
 * An optional forced edge tests whether a particular candidate has support.
 * This avoids enumerating up to 9! permutations of a cage.
 */
function canAssign(masks: number[], forcedCell = -1, forcedDigit = 0): boolean {
  const owner = Array<number>(10).fill(-1);
  if (forcedCell >= 0) owner[forcedDigit] = forcedCell;
  function augment(cell: number, visited: Set<number>): boolean {
    for (const digit of digitsOf(masks[cell])) {
      if (digit === forcedDigit || visited.has(digit)) continue;
      visited.add(digit);
      if (owner[digit] < 0 || augment(owner[digit], visited)) {
        owner[digit] = cell;
        return true;
      }
    }
    return false;
  }
  return masks.every((_, cell) => cell === forcedCell || augment(cell, new Set()));
}

export function cageSupports(grid: Grid, cage: Cage): { combinations: number[][]; supports: number[] } {
  const supports = cage.cells.map(() => 0);
  const combinations: number[][] = [];
  const sets = (cage.operation === 'psycho' ? psychoTables : cage.operation === 'product' ? productTables : tables).get(cage.cells.length)?.find(row => row.sum === cage.sum)?.combinations ?? [];
  for (const digits of sets) {
    const setMask = digits.reduce((mask, d) => mask | bit(d), 0);
    const masks = cage.cells.map(cell => (grid.values[cell] ? bit(grid.values[cell]) : grid.cands[cell]) & setMask);
    if (masks.some(mask => !mask) || !canAssign(masks)) continue;
    combinations.push(digits);
    masks.forEach((mask, index) => {
      for (const digit of digitsOf(mask & ~supports[index])) {
        if (canAssign(masks, index, digit)) supports[index] |= bit(digit);
      }
    });
  }
  return { combinations, supports };
}

export function nextKillerStep(grid: Grid, cages: Cage[]): SolverResult {
  if (new Set(cages.flatMap(c => c.cells)).size !== cages.flatMap(c => c.cells).length
    || cages.some(c => c.cells.some(i => !Number.isInteger(i) || i < 0 || i >= 81))) {
    return { status: 'contradiction', message: 'Cages must use valid cells without overlapping.' };
  }
  if (isBroken(grid) || UNITS.some(unit => {
    const values = unit.map(i => grid.values[i]).filter(Boolean);
    return new Set(values).size !== values.length;
  })) return { status: 'contradiction', message: 'The current digits or candidates contradict Sudoku rules.' };

  let cageStep: Deduction | null = null;
  for (const cage of cages) {
    const { combinations, supports } = cageSupports(grid, cage);
    const operation = cage.operation ?? 'sum';
    const operationName = operation === 'psycho' ? 'sum or product' : operation;
    const name = 'Cage at ' + cellName(cage.cells[0]);
    if (!combinations.length) return { status: 'contradiction', message: name + ' has no valid combination for ' + operation + ' ' + cage.sum + '.' };
    if (cageStep) continue;
    const empty = cage.cells.filter(i => !grid.values[i]);
    if (empty.length === 1 && operation !== 'psycho') {
      const usedSum = cage.cells.reduce((total, i) => operation === 'product' ? total * (grid.values[i] || 1) : total + grid.values[i], operation === 'product' ? 1 : 0);
      const digit = operation === 'product' ? cage.sum / usedSum : cage.sum - usedSum;
      cageStep = {
        technique: 'Cage remainder',
        description: name + ': the placed digits have ' + operation + ' ' + usedSum + '. The remaining cell ' + cellName(empty[0]) + ' must be ' + cage.sum + (operation === 'product' ? ' ÷ ' : ' − ') + usedSum + ' = ' + digit + '.',
        placements: [{ cell: empty[0], digit }], eliminations: [], cells: cage.cells,
        supportCells: cage.cells,
        supportDigits: cage.cells.filter(cell => grid.values[cell]).map(cell => ({ cell, digit: grid.values[cell] })),
      };
      continue;
    }
    const eliminations = cage.cells.flatMap((cell, index) => grid.values[cell] ? [] :
      digitsOf(grid.cands[cell] & ~supports[index]).map(digit => ({ cell, digit })));
    if (eliminations.length) cageStep = {
      technique: 'Cage combinations',
      description: name + ' has ' + cage.cells.length + ' cells and ' + operationName + ' ' + cage.sum + (operation === 'psycho' ? '. Both operations are considered; only candidates impossible under both can be removed' : '') + '. Compatible digit sets: ' +
        combinations.map(d => '{' + d.join(', ') + '}').join('; ') +
        '. Matching these distinct digits to the current cell candidates rules out the listed candidates: none can occur in a valid assignment of this cage.',
      placements: [], eliminations, cells: cage.cells,
      supportCells: cage.cells,
      supportDigits: cage.cells.flatMap((cell, index) => digitsOf(supports[index]).map(digit => ({ cell, digit }))),
    };
  }
  if (isSolved(grid)) return { status: 'solved', message: 'Solved: every row, column, box and cage satisfies its rules.' };
  if (cageStep) return { status: 'step', step: cageStep };
  const step = findNextStep(grid, false, logicalOrder); // No guesses or generated solution.
  const pattern = step ? [...(step.primary ?? []), ...(step.secondary ?? []),
    ...(step.colouring?.clusters ?? []).flatMap(cluster => [...cluster.dark, ...cluster.light]),
    ...(step.links ?? []).flatMap(link => [...link.from, ...link.to]),
  ].filter(item => !step.eliminations.some(e => e.cell === item.cell && e.digit === item.digit)) : [];
  if (step) return { status: 'step', step: {
    technique: TECHNIQUES.find(t => t.id === step.tech)?.name ?? step.tech,
    description: step.description, placements: step.placements, eliminations: step.eliminations,
    links: deductionLinks(step),
    cells: [...new Set([...step.placements, ...step.eliminations, ...(step.primary ?? []), ...(step.secondary ?? [])].map(item => item.cell))],
    supportCells: [...new Set([
      ...pattern.map(item => item.cell),
      ...(step.units ?? []).flatMap(band => UNITS[band.unit]),
    ])],
    supportDigits: [...pattern,
      ...(step.tech === 'FULL_HOUSE' ? (step.units ?? []).flatMap(band => UNITS[band.unit])
        .filter(cell => grid.values[cell]).map(cell => ({ cell, digit: grid.values[cell] })) : []),
    ].filter(({ cell, digit }) => grid.values[cell] === digit || (!grid.values[cell] && !!(grid.cands[cell] & bit(digit)))),
  } };
  return { status: 'stalled', message: 'No further logical deduction was found using cage combinations and the imported techniques. This puzzle may need stronger techniques or may have multiple solutions. No guess or hidden solution digit has been used.' };
}

export function applyDeduction(grid: Grid, cages: Cage[], step: Deduction): Grid {
  const next = cloneGrid(grid);
  for (const { cell, digit } of step.placements) {
    setValue(next, cell, digit);
    // Also propagate the no-repeat rule to cage peers outside Sudoku houses.
    for (const peer of cages.find(c => c.cells.includes(cell))?.cells ?? []) {
      if (peer !== cell) next.cands[peer] &= ~bit(digit);
    }
  }
  for (const { cell, digit } of step.eliminations) next.cands[cell] &= ~bit(digit);
  return next;
}
