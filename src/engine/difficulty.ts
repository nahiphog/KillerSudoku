export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

/** App-specific bands: only the hardest deduction matters, never step count. */
export const DIFFICULTY_TECHNIQUES: Record<Difficulty, readonly string[]> = {
  Easy: ['Cage combinations', 'Cage remainder', 'Full House', 'Naked Single', 'Hidden Single'],
  Medium: ['Locked Candidates (Pointing)', 'Locked Candidates (Claiming)', 'Naked Pair', 'Hidden Pair', 'Naked Triple', 'Hidden Triple'],
  Hard: ['Naked Quadruple', 'X-Wing', 'W-Wing', 'XY-Wing', 'XYZ-Wing', 'Phistomefel Ring'],
  Expert: ['Hidden Quadruple', 'Swordfish', 'Jellyfish', 'Empty Rectangle', 'Remote Pairs'],
};
export function techniqueDifficulty(technique: string): Difficulty {
  const level = DIFFICULTIES.find(d => DIFFICULTY_TECHNIQUES[d].includes(technique));
  if (!level) throw new Error('Unrated logical technique: ' + technique);
  return level;
}
export function techniqueRank(technique: string): number {
  const level = techniqueDifficulty(technique);
  return DIFFICULTIES.indexOf(level) * 100 + DIFFICULTY_TECHNIQUES[level].indexOf(technique);
}
