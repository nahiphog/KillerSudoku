import { bit } from '../vendor/sudokui/board';
import { generateFullGrid } from './generator';
import { cageOptionsError, DEFAULT_CAGE_SIZES, generateCages, type Cage, type CageOptions } from './cages';
import { applyDeduction, nextKillerStep, startSolver, type Deduction } from './killerSolver';
import { DIFFICULTIES, techniqueDifficulty, techniqueRank, type Difficulty } from './difficulty';

export interface LogicalProof { values: number[]; steps: number; difficulty: Difficulty; hardestTechnique: string; deductions: Deduction[]; techniqueTally: Record<string, number> }
export interface PuzzleOptions extends CageOptions { difficulty?: Difficulty }

/** A complete chain of solution-preserving deductions proves existence AND
 * uniqueness. No guessing, solution counter or hidden digits enter the solver.
 * The optional deadline rejects incomplete proofs; it never accepts them.
 */
export function proveLogically(cages: Cage[], deadline = Infinity): LogicalProof | null {
  let grid = startSolver();
  let hardestTechnique = 'Cage combinations';
  const deductions: Deduction[] = [];
  const techniqueTally: Record<string, number> = {};
  for (let steps = 0; steps <= 810; steps++) {
    if (Date.now() >= deadline) return null;
    const result = nextKillerStep(grid, cages);
    if (result.status === 'solved') return { values: Array.from(grid.values), steps, difficulty: techniqueDifficulty(hardestTechnique), hardestTechnique, deductions, techniqueTally };
    if (result.status !== 'step' || result.step.technique === 'Brute Force') return null;
    const step = result.step;
    if (techniqueRank(step.technique) > techniqueRank(hardestTechnique)) hardestTechnique = step.technique;
    if (!step.placements.some(p => !grid.values[p.cell] && (grid.cands[p.cell] & bit(p.digit)))
      && !step.eliminations.some(e => !grid.values[e.cell] && (grid.cands[e.cell] & bit(e.digit)))) return null;
    grid = applyDeduction(grid, cages, step);
    deductions.push(step);
    techniqueTally[step.technique] = (techniqueTally[step.technique] ?? 0) + 1;
  }
  return null;
}

export interface VerifiedPuzzle { values: number[]; cages: Cage[]; proofSteps: number; attempts: number; difficulty: Difficulty; hardestTechnique: string; deductions: Deduction[]; techniqueTally: Record<string, number>; elapsedMilliseconds: number }
export interface GenerationLimits {
  maxAttempts?: number;
  maxMilliseconds?: number;
  random?: () => number;
  onProgress?: (attempt: number) => void;
}

/** Only a fully certified puzzle can leave this function. */
export function generateVerifiedPuzzle(options: PuzzleOptions, limits: GenerationLimits = {}): VerifiedPuzzle {
  const requested = options.difficulty ?? 'Easy';
  if (!DIFFICULTIES.includes(requested)) throw new Error('Choose Easy, Medium, Hard or Expert.');
  const error = cageOptionsError(options);
  if (error) throw new Error(error);
  const sizes = options.sizes ?? DEFAULT_CAGE_SIZES;
  if (sizes.every(size => size === 9)) throw new Error('Nine-cell cages all sum to 45 and cannot give a unique puzzle. Allow smaller cage sizes.');
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
    try { cages = generateCages(grid.values, canUseSmall && attempt % 5 !== 0 ? smallOptions : options, random, requested === 'Easy' || attempt % 3 === 0); }
    catch { continue; }
    const proof = proveLogically(cages, deadline);
    if (!proof || proof.difficulty !== requested || proof.values.some((value, i) => value !== grid.values[i])) continue;
    return { values: proof.values, cages, proofSteps: proof.steps, attempts: attempt, difficulty: proof.difficulty, hardestTechnique: proof.hardestTechnique, deductions: proof.deductions, techniqueTally: proof.techniqueTally, elapsedMilliseconds: performance.now() - started };
  }
  throw new Error(`No uniquely solvable puzzle at ${requested} difficulty was verified within this search. Try again, choose another level, or allow more cage sizes. Your previous puzzle is unchanged.`);
}
