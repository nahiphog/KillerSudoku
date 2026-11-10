import { TECHS, type Tech } from '../vendor/sudokui/ratings';
import { TECHNIQUES } from './solver';

export function techniqueScore(name: string): number {
  if (name === 'Brute Force') return 10000;
  if (name === 'Cage combinations' || name === 'Cage remainder') return 3;
  const technique = TECHNIQUES.find(technique => technique.name === name);
  if (!technique) throw new Error('Unknown technique: ' + name);
  return TECHS[technique.id as Tech].score;
}

export function scoredTally(tally: Record<string, number>) {
  return Object.entries(tally).map(([technique, count]) => ({
    technique, count, rating: techniqueScore(technique), score: techniqueScore(technique) * count,
  })).sort((a, b) => a.rating - b.rating || a.technique.localeCompare(b.technique));
}
