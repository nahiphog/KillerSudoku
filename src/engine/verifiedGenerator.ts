import { countKillerSolutions, digCages, solveKillerBySearch, type DigProgress } from './digging';
import type { ManualBoard } from './manualPlay';
import { bit, cloneGrid, type Grid } from '../vendor/sudokui/board';
import { generateFullGrid } from './generator';
import { cageOptionsError, DEFAULT_CAGE_SIZES, generateCages, type Cage, type CageOptions } from './cages';
import { applyDeduction, nextKillerStep, psychoOperationSteps, startSolver, type Deduction } from './killerSolver';
import { techniqueDifficulty, techniqueRank, type Difficulty } from './difficulty';

export interface LogicalProof { values: number[]; complete: boolean; steps: number; difficulty: Difficulty; hardestTechnique: string; deductions: Deduction[]; techniqueTally: Record<string, number> }
export type PuzzleOptions = CageOptions & { dig?: boolean; digPairs?: boolean; digSingletons?: boolean; logicOnly?: boolean; retainedCageSizes?: readonly number[] };

export function retainedCageSizesError(options: PuzzleOptions): string | null {
  const required = options.retainedCageSizes ?? [];
  if (required.some(size => !Number.isInteger(size) || size < 1 || size > 9)) return 'Retained cage sizes must be between 1 and 9; cages cannot contain repeated digits.';
  if (required.some(size => !(options.sizes ?? DEFAULT_CAGE_SIZES).includes(size))) return 'Enable every required cage size in Allowed cells per cage.';
  if (options.dig && options.digSingletons && (options.sizes ?? DEFAULT_CAGE_SIZES).every(size => size === 1)) return 'Allow larger cages to remove all 1-cell cages while preserving a unique solution.';
  return null;
}

/** Logical traces prove uniqueness when complete without search. Optional
 * search fallback is reserved for walkthroughs of already verified puzzles;
 * proveLogically never enables it. No generated answer enters the solver. */
export function traceLogically(cages: Cage[], deadline = Infinity, allowBruteForce = false, initial?: Grid): LogicalProof | null {
  let grid = initial ? cloneGrid(initial) : startSolver();
  let searchedSolution: number[] | null = null;
  let hardestTechnique = 'Cage combinations';
  const deductions: Deduction[] = [];
  const techniqueTally: Record<string, number> = {};
  const revealedOperations = new Set<number>();
  for (let steps = 0; steps <= 810; steps++) {
    if (Date.now() >= deadline) return null;
    for(const explanation of psychoOperationSteps(grid,cages,revealedOperations)) {
      revealedOperations.add(explanation.cageOperation!.cell);
      deductions.push(explanation);
      techniqueTally['Cage operation']=(techniqueTally['Cage operation'] ?? 0)+1;
    }
    let result = nextKillerStep(grid, cages);
    if (result.status === 'stalled' && allowBruteForce) {
      searchedSolution ??= solveKillerBySearch(cages, grid, deadline);
      if (!searchedSolution) return null;
      const cell = Array.from(grid.values).findIndex(value => !value);
      const digit = searchedSolution[cell];
      result = { status: 'step', step: {
        technique: 'Brute Force',
        description: 'All available logical techniques are exhausted. Cage-aware backtracking searches the remaining candidates while enforcing every row, column, box and cage. Place ' + digit + ' in r' + (Math.floor(cell / 9) + 1) + 'c' + (cell % 9 + 1) + ' from the searched solution, then retry logical techniques. This is a search step, rated 10000 per use.',
        placements: [{cell, digit}], eliminations: [], cells: [cell], supportCells: [], supportDigits: [],
      } };
    }
    if (result.status === 'solved' || result.status === 'stalled') return { complete: result.status === 'solved', values: Array.from(grid.values), steps: deductions.length, difficulty: hardestTechnique === 'Brute Force' ? 'Expert' : techniqueDifficulty(hardestTechnique), hardestTechnique, deductions, techniqueTally };
    if (result.status !== 'step') return null;
    const step = result.step;
    if (step.technique === 'Brute Force' || (hardestTechnique !== 'Brute Force' && techniqueRank(step.technique) > techniqueRank(hardestTechnique))) hardestTechnique = step.technique;
    if (!step.placements.some(p => !grid.values[p.cell] && (grid.cands[p.cell] & bit(p.digit)))
      && !step.eliminations.some(e => !grid.values[e.cell] && (grid.cands[e.cell] & bit(e.digit)))) return null;
    grid = applyDeduction(grid, cages, step);
    deductions.push(step);
    techniqueTally[step.technique] = (techniqueTally[step.technique] ?? 0) + 1;
  }
  return null;
}

export function proveLogically(cages: Cage[], deadline = Infinity): LogicalProof | null {
  const trace = traceLogically(cages, deadline);
  return trace?.complete ? trace : null;
}

export interface VerifiedPuzzle { cageFreeCells?: number[]; entries?: ManualBoard; logicallySolved: boolean; digging?: DigProgress; values: number[]; cages: Cage[]; proofSteps: number; attempts: number; difficulty: Difficulty; hardestTechnique: string; deductions: Deduction[]; techniqueTally: Record<string, number>; elapsedMilliseconds: number }
export interface GenerationLimits {
  maxDigMilliseconds?: number;
  onDigProgress?: (progress: DigProgress) => void;
  maxAttempts?: number;
  maxMilliseconds?: number;
  random?: () => number;
  onProgress?: (attempt: number) => void;
}

/** Only a fully certified puzzle can leave this function. */
export function generateVerifiedPuzzle(options: PuzzleOptions, limits: GenerationLimits = {}): VerifiedPuzzle {
  const error = cageOptionsError(options) ?? retainedCageSizesError(options);
  if (error) throw new Error(error);
  const sizes = options.sizes ?? DEFAULT_CAGE_SIZES;
  if (sizes.every(size => size === 9)) throw new Error('Nine-cell cages all contain digits 1–9 and cannot give a unique puzzle. Allow smaller cage sizes.');
  const requiredSizes = options.retainedCageSizes ?? [];
  const retainedSizes = requiredSizes.filter(size => !(options.dig && options.digSingletons && size === 1));
  const hasRequiredCage = (cages: Cage[]) => retainedSizes.every(size => cages.some(cage => cage.cells.length === size))
    && (options.operation !== 'mixed' || (cages.some(c=>(c.operation ?? 'sum')==='sum') && cages.some(c=>c.operation==='product')));
  const random = limits.random ?? Math.random;
  const started = performance.now();
  const deadline = Date.now() + (limits.maxMilliseconds ?? 45000);
  // Smaller cages provide stronger clues. Periodic attempts use all allowed sizes.
  const smallOptions = { ...options, sizes: sizes.filter(size => size <= 3) };
  const canUseSmall = !cageOptionsError(smallOptions);
  for (let attempt = 1; attempt <= (limits.maxAttempts ?? 1500) && Date.now() < deadline; attempt++) {
    limits.onProgress?.(attempt);
    const grid = generateFullGrid(random);
    let cages: Cage[];
    try { cages = generateCages(grid.values, canUseSmall && requiredSizes.every(size => size <= 3) && attempt % 5 !== 0 ? { ...smallOptions, requiredSizes } : { ...options, requiredSizes }, random, attempt % 3 === 0); }
    catch { continue; }
    if (!hasRequiredCage(cages)) continue;
    let proof = proveLogically(cages, deadline);
    if (!proof || proof.values.some((value, i) => value !== grid.values[i])) continue;
    let digging: DigProgress | undefined;
    if (options.dig) {
      const digDeadline = Date.now() + (limits.maxDigMilliseconds ?? 120000);
      const requireLogicalSolve = options.logicOnly !== false;
      const preservesLogicalSolve = (trial: Cage[]) => {
        const candidateProof = proveLogically(trial, digDeadline);
        return !!candidateProof && candidateProof.values.every((value, i) => value === grid.values[i]);
      };
      // Remove every singleton atomically; reject candidates that lose solvability.
      const initialCount = cages.length;
      if (options.digSingletons) {
        const trial = cages.filter(cage => cage.cells.length !== 1);
        if (trial.length !== cages.length) {
          if (!hasRequiredCage(trial) || (requireLogicalSolve && !preservesLogicalSolve(trial))
            || countKillerSolutions(trial, digDeadline, Array.from(grid.values)) !== 1) continue;
          cages = trial;
        }
      }
      const singletonRemovals = initialCount - cages.length;
      const includeSingletons = (progress: DigProgress): DigProgress => ({ paired: progress.paired, pass: progress.pass,
        tested: progress.tested + singletonRemovals, total: initialCount, removed: progress.removed + singletonRemovals });
      const result = digCages(cages, random, digDeadline, progress => limits.onDigProgress?.(includeSingletons(progress)), Array.from(grid.values),
        (options.digPairs ?? true) && options.symmetric !== false,
        requireLogicalSolve || requiredSizes.length || options.operation === 'mixed' ? trial => hasRequiredCage(trial) && (!requireLogicalSolve || preservesLogicalSolve(trial)) : undefined);
      cages = result.cages;
      digging = includeSingletons(result);
      proof = requireLogicalSolve ? proveLogically(cages, digDeadline) : traceLogically(cages, digDeadline, true);
      if (!proof) throw new Error('Unable to finish the dug puzzle walkthrough within the time limit. Try again.');
    }
    if (options.logicOnly !== false && (!proof.complete || proof.techniqueTally['Brute Force']
      || proof.values.some((value, i) => value !== grid.values[i]))) {
      throw new Error('A complete logical solution could not be verified. Your previous puzzle is unchanged.');
    }
    return { logicallySolved: proof.complete && !proof.techniqueTally['Brute Force'], digging, values: Array.from(grid.values), cages, proofSteps: proof.steps, attempts: attempt, difficulty: proof.difficulty, hardestTechnique: proof.hardestTechnique, deductions: proof.deductions, techniqueTally: proof.techniqueTally, elapsedMilliseconds: performance.now() - started };
  }
  throw new Error(`No uniquely solvable puzzle was verified within this search. Try again or allow more cage sizes. Your previous puzzle is unchanged.`);
}
