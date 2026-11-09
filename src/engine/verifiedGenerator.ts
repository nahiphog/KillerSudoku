import { bit } from '../vendor/sudokui/board';
import { generateFullGrid } from './generator';
import { cageOptionsError, DEFAULT_CAGE_SIZES, generateCages, type Cage, type CageOptions } from './cages';
import { applyDeduction, nextKillerStep, startSolver } from './killerSolver';

export interface LogicalProof { values: number[]; steps: number }

/** A complete chain of solution-preserving deductions proves existence AND
 * uniqueness. No guessing, solution counter or hidden digits enter the solver.
 * The optional deadline rejects incomplete proofs; it never accepts them.
 */
export function proveLogically(cages: Cage[], deadline = Infinity): LogicalProof | null {
  let grid = startSolver();
  for (let steps = 0; steps <= 810; steps++) {
    if (Date.now() >= deadline) return null;
    const result = nextKillerStep(grid, cages);
    if (result.status === 'solved') return { values: Array.from(grid.values), steps };
    if (result.status !== 'step' || result.step.technique === 'Brute Force') return null;
    const step = result.step;
    if (!step.placements.some(p => !grid.values[p.cell] && (grid.cands[p.cell] & bit(p.digit)))
      && !step.eliminations.some(e => !grid.values[e.cell] && (grid.cands[e.cell] & bit(e.digit)))) return null;
    grid = applyDeduction(grid, cages, step);
  }
  return null;
}

export interface VerifiedPuzzle { values: number[]; cages: Cage[]; proofSteps: number; attempts: number }
export interface GenerationLimits {
  maxAttempts?: number;
  maxMilliseconds?: number;
  random?: () => number;
  onProgress?: (attempt: number) => void;
}

/** Only a fully certified puzzle can leave this function. */
export function generateVerifiedPuzzle(options: CageOptions, limits: GenerationLimits = {}): VerifiedPuzzle {
  const error = cageOptionsError(options);
  if (error) throw new Error(error);
  const sizes = options.sizes ?? DEFAULT_CAGE_SIZES;
  if (sizes.every(size => size === 9)) throw new Error('Nine-cell cages all sum to 45 and cannot give a unique puzzle. Allow smaller cage sizes.');
  const random = limits.random ?? Math.random;
  const deadline = Date.now() + (limits.maxMilliseconds ?? 45000);
  // Smaller cages provide stronger clues. Periodic attempts use all allowed sizes.
  const smallOptions = { ...options, sizes: sizes.filter(size => size <= 3) };
  const canUseSmall = !cageOptionsError(smallOptions);
  for (let attempt = 1; attempt <= (limits.maxAttempts ?? 300) && Date.now() < deadline; attempt++) {
    limits.onProgress?.(attempt);
    const grid = generateFullGrid(random);
    let cages: Cage[];
    try { cages = generateCages(grid.values, canUseSmall && attempt % 5 !== 0 ? smallOptions : options, random); }
    catch { continue; }
    const proof = proveLogically(cages, deadline);
    if (!proof || proof.values.some((value, i) => value !== grid.values[i])) continue;
    return { values: proof.values, cages, proofSteps: proof.steps, attempts: attempt };
  }
  throw new Error('No uniquely solvable puzzle was verified within this search. Try again or allow 2- and 3-cell cages. Your previous puzzle is unchanged.');
}
