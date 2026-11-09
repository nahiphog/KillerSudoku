import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, techniqueDifficulty, techniqueRank } from '../src/engine/difficulty';
import { TECHNIQUES } from '../src/engine/solver';
import { generateVerifiedPuzzle, proveLogically } from '../src/engine/verifiedGenerator';

describe('difficulty bands', () => {
  it('rates every logical technique and excludes brute force', () => {
    for (const technique of TECHNIQUES.filter(t => t.id !== 'BRUTE_FORCE')) expect(DIFFICULTIES).toContain(techniqueDifficulty(technique.name));
    expect(techniqueDifficulty('Cage combinations')).toBe('Easy');
    expect(techniqueDifficulty('Cage remainder')).toBe('Easy');
    expect(() => techniqueDifficulty('Brute Force')).toThrow('Unrated');
    expect(() => techniqueDifficulty('unknown')).toThrow('Unrated');
  });
  it('orders bands independently of total deduction count', () => {
    expect(techniqueDifficulty('Hidden Single')).toBe('Easy');
    expect(techniqueDifficulty('Hidden Triple')).toBe('Medium');
    expect(techniqueDifficulty('X-Wing')).toBe('Hard');
    expect(techniqueDifficulty('Jellyfish')).toBe('Expert');
    expect(techniqueDifficulty('Hidden Quadruple')).toBe('Expert');
    expect(techniqueRank('XYZ-Wing')).toBeLessThan(techniqueRank('Swordfish'));
  });
  it('rejects invalid requests and never substitutes a different level on failure', () => {
    expect(() => generateVerifiedPuzzle({ difficulty: 'Invalid' as never })).toThrow('Choose Easy');
    for (const difficulty of DIFFICULTIES) expect(() => generateVerifiedPuzzle({ difficulty }, { maxAttempts: 0 })).toThrow(`at ${difficulty} difficulty`);
  });

  it('generates and re-rates a genuinely matching puzzle for all four levels', () => {
    let seed = 1;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generateVerifiedPuzzle({ difficulty }, { random, maxMilliseconds: 30000 });
      expect(puzzle.difficulty).toBe(difficulty);
      expect(techniqueDifficulty(puzzle.hardestTechnique)).toBe(difficulty);
      const proof = proveLogically(puzzle.cages);
      expect(proof?.difficulty).toBe(difficulty);
      expect(proof?.hardestTechnique).toBe(puzzle.hardestTechnique);
      expect(proof?.steps).toBe(puzzle.proofSteps);
      expect(proof?.values).toEqual(puzzle.values);
    }
  }, 125000);
});
