import type { Cage } from './cages';
import { scoredTally } from './techniqueScores';
import type { VerifiedPuzzle } from './verifiedGenerator';

export const TRIAL_COUNTS = [1, 10, 100, 1000, 10000, 100000, 1000000];
export const RATING_THRESHOLDS = [0, 1000, 2000, 3000, 5000, 10000, 1000000];
export const HISTOGRAM_EDGES = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000, 50000, 100000, 1000000, Infinity];
export interface SimulationResult { cages: Cage[]; solution: string; rating: number; elapsedMilliseconds: number; bruteForce: boolean }
export interface SimulationRecord extends SimulationResult { trial: number; displayedAt: number }
export function simulationResult(puzzle: VerifiedPuzzle): SimulationResult {
  return { cages: puzzle.cages, solution: puzzle.values.join(''), rating: scoredTally(puzzle.techniqueTally).reduce((sum, row) => sum + row.score, 0),
    elapsedMilliseconds: puzzle.elapsedMilliseconds, bruteForce: !!puzzle.techniqueTally['Brute Force'] };
}
export function matchesSimulation(result: Pick<SimulationResult, 'rating' | 'bruteForce'>, minimum: number, noBruteForce: boolean) {
  return result.rating >= minimum && (!noBruteForce || !result.bruteForce);
}
export function histogramBin(rating: number) {
  return HISTOGRAM_EDGES.findIndex((edge, index) => rating >= edge && rating < HISTOGRAM_EDGES[index + 1]);
}
