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
  it('reports an exhausted search without requiring a difficulty', () => {
    expect(() => generateVerifiedPuzzle({}, { maxAttempts: 0 })).toThrow('No uniquely solvable puzzle');
  });
  it('reports the actual rating without selecting a requested level', () => {
    let seed = 1;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let sample = 0; sample < 5; sample++) {
      const puzzle = generateVerifiedPuzzle({}, { random, maxMilliseconds: 30000 });
      expect(DIFFICULTIES).toContain(puzzle.difficulty);
      expect(techniqueDifficulty(puzzle.hardestTechnique)).toBe(puzzle.difficulty);
      const proof = proveLogically(puzzle.cages);
      expect(proof?.difficulty).toBe(puzzle.difficulty);
      expect(proof?.hardestTechnique).toBe(puzzle.hardestTechnique);
      expect(proof?.values).toEqual(puzzle.values);
    }
  }, 125000);
});
