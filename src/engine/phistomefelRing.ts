import { bit, cellName, type Grid } from '../vendor/sudokui/board';
import type { Deduction } from './killerSolver';

export const PHISTOMEFEL_RING = [20,21,22,23,24,29,33,38,42,47,51,56,57,58,59,60];
export const PHISTOMEFEL_CORNERS = [0,1,7,8,9,10,16,17,63,64,70,71,72,73,79,80];

/** Equal multisets imply equal occurrence counts for each digit. Bounds use
 * only placed digits and current candidates, never the generated solution. */
export function findPhistomefelRing(grid: Grid): Deduction | null {
  const regions = [PHISTOMEFEL_RING, PHISTOMEFEL_CORNERS];
  const names = ['central ring', 'four corner blocks'];
  for (let digit = 1; digit <= 9; digit++) {
    const mask = bit(digit);
    const counts = regions.map(cells => {
      const fixed = cells.filter(cell => grid.values[cell] === digit || (!grid.values[cell] && grid.cands[cell] === mask));
      const optional = cells.filter(cell => !grid.values[cell] && grid.cands[cell] !== mask && !!(grid.cands[cell] & mask));
      return { fixed, optional, min: fixed.length, max: fixed.length + optional.length };
    });
    const lower = Math.max(...counts.map(count => count.min));
    const upper = Math.min(...counts.map(count => count.max));
    // Inconsistent candidates are not evidence for a valid deduction.
    if (lower > upper) continue;
    const placements: Deduction['placements'] = [];
    const eliminations: Deduction['eliminations'] = [];
    const reasons: string[] = [];
    counts.forEach((count,index) => {
      if (!count.optional.length) return;
      if (count.min === upper) {
        eliminations.push(...count.optional.map(cell => ({cell,digit})));
        reasons.push(`The ${names[index]} already has ${count.min} guaranteed occurrence(s), reaching the shared maximum ${upper}; remove ${digit} from ${count.optional.map(cellName).join(', ')}.`);
      } else if (count.max === lower) {
        placements.push(...count.optional.map(cell => ({cell,digit})));
        reasons.push(`The ${names[index]} needs at least ${lower} occurrence(s), and only ${count.max} are possible; every remaining position must be ${digit}: ${count.optional.map(cellName).join(', ')}.`);
      }
    });
    if (!placements.length && !eliminations.length) continue;
    const supportCells = regions.flat();
    return {
      technique: 'Phistomefel Ring',
      description: `The 16 central-ring cells and the 16 corner cells contain identical digit tallies, including repetitions. For digit ${digit}, ` +
        counts.map((count,index) => `the ${names[index]} has ${count.min} guaranteed and at most ${count.max} possible occurrence(s)`).join('; ') +
        `. Their common count must be ${lower === upper ? String(lower) : `${lower}–${upper}`}. ` + reasons.join(' '),
      placements, eliminations, cells: supportCells, supportCells,
      supportDigits: supportCells.filter(cell => grid.values[cell] === digit || (!grid.values[cell] && !!(grid.cands[cell] & mask)))
        .filter(cell => !eliminations.some(item => item.cell === cell) && !placements.some(item => item.cell === cell))
        .map(cell => ({cell,digit})),
    };
  }
  return null;
}
