import { describe, expect, it } from 'vitest';
import examples from './technique-examples.json';
import { TECHNIQUES } from '../src/engine/solver';
import { bit, gridFromValues, sees, UNITS } from '../src/vendor/sudokui/board';
import { deductionLinks } from '../src/engine/deductionLinks';

describe('candidate links', () => {
  it.each(['REMOTE_PAIR', 'W_WING', 'XY_WING'] as const)('preserves valid candidate relationships for %s', id => {
    const example = examples[id];
    const grid = gridFromValues([...example.values].map(Number));
    grid.cands.set(example.cands);
    const step = TECHNIQUES.find(t => t.id === id)!.find(grid)!;
    expect(step).not.toBeNull();
    const links = deductionLinks(step);
    expect(links.some(link => link.strong)).toBe(true);
    expect(links.some(link => !link.strong)).toBe(true);
    for (const link of links) {
      expect(link.from).toHaveLength(1); expect(link.to).toHaveLength(1);
      const [a, b] = [link.from[0], link.to[0]];
      for (const candidate of [a, b]) expect(grid.cands[candidate.cell] & bit(candidate.digit)).not.toBe(0);
      if (a.cell === b.cell) {
        expect(a.digit).not.toBe(b.digit);
        if (link.strong) expect(grid.cands[a.cell]).toBe(bit(a.digit) | bit(b.digit));
      } else {
        expect(a.digit).toBe(b.digit); expect(sees(a.cell, b.cell)).toBe(true);
        if (link.strong) expect(UNITS.some(unit => unit.includes(a.cell) && unit.includes(b.cell)
          && unit.filter(cell => grid.cands[cell] & bit(a.digit)).length === 2)
          || (id === 'REMOTE_PAIR' && grid.cands[a.cell] === grid.cands[b.cell])).toBe(true);
      }
    }
    if (id === 'XY_WING' || id === 'W_WING') {
      expect(links.slice(0, 5).map(link => link.strong)).toEqual([true, false, true, false, true]);
      for (const target of step.eliminations) expect(links.filter(link => link.to[0].cell === target.cell && link.to[0].digit === target.digit)).toHaveLength(2);
    }
  });
});
