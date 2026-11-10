import { expect, it } from 'vitest';
import { scoredTally, techniqueScore } from '../src/engine/techniqueScores';

it('charges 3 for every use of either cage technique', () => {
  expect(techniqueScore('Cage combinations')).toBe(3);
  expect(techniqueScore('Cage remainder')).toBe(3);
  const tally = scoredTally({ 'Cage combinations': 10, 'Cage remainder': 4 });
  expect(tally.map(row => row.score)).toEqual([30, 12]);
});
it('sorts by per-use rating rather than use count or weighted total', () => {
  const rows = scoredTally({ 'X-Wing': 1, 'Naked Single': 2, 'Cage remainder': 100, 'Full House': 4 });
  expect(rows.map(row => row.rating)).toEqual([3, 4, 4, 140]);
  expect(rows.map(row => row.technique)).toEqual(['Cage remainder', 'Full House', 'Naked Single', 'X-Wing']);
  expect(rows.reduce((sum, row) => sum + row.score, 0)).toBe(464);
});

it('rates each Brute Force use at 10000 and lists it last', () => {
 const rows = scoredTally({'Brute Force':2,'Cage remainder':1});
 expect(rows.at(-1)).toEqual({technique:'Brute Force',count:2,rating:10000,score:20000});
});
