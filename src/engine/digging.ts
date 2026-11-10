import { bit, cloneGrid, digitsOf, emptyGrid, isBroken, popcount, setValue, UNITS, PEERS, type Grid } from '../vendor/sudokui/board';
import { cageSupports } from './killerSolver';
import type { Cage } from './cages';

function checkDeadline(deadline: number) {
  if (Date.now() >= deadline) throw new Error('Digging verification timed out. No unfinished dug grid was accepted. Try again; your previous puzzle is unchanged.');
}

/** Exact search from zero givens; stop at two solutions. Search is used only
 * for certification, never as a deduction in the logical walkthrough. */
export function countKillerSolutions(cages: Cage[], deadline = Infinity, knownSolution?: number[]): number {
  const cells = cages.flatMap(c => c.cells);
  if (new Set(cells).size !== cells.length || cells.some(i => !Number.isInteger(i) || i < 0 || i > 80)) throw new Error('Invalid cage cells.');
  let count = 0;
  const cache = new Map<Cage, Map<string, ReturnType<typeof cageSupports>>>();
  const neighbors = Array.from({length:81}, (_, cell) => [...new Set([...PEERS[cell], ...cages.find(c=>c.cells.includes(cell))?.cells ?? []])].filter(i=>i!==cell));
  function search(grid: Grid) {
    checkDeadline(deadline);
    let changed = true;
    while (changed) {
      checkDeadline(deadline);
      changed = false;
      for (const cage of cages) {
        let memo = cache.get(cage);
        if (!memo) { memo = new Map(); cache.set(cage, memo); }
        const key = cage.cells.map(cell => grid.values[cell] ? bit(grid.values[cell]) : grid.cands[cell]).join(',');
        let result = memo.get(key);
        if (!result) {
          result = cageSupports(grid, cage);
          if (memo.size > 10000) memo.clear();
          memo.set(key, result);
        }
        const { combinations, supports } = result;
        if (!combinations.length) return;
        cage.cells.forEach((cell, index) => {
          if (!grid.values[cell]) {
            const mask = grid.cands[cell] & supports[index];
            if (mask !== grid.cands[cell]) { grid.cands[cell] = mask; changed = true; }
          }
        });
      }
      if (isBroken(grid)) return;
      for (let cell = 0; cell < 81; cell++) {
        if (!grid.values[cell] && popcount(grid.cands[cell]) === 1) {
          setValue(grid, cell, digitsOf(grid.cands[cell])[0]); changed = true;
        }
      }
      for (const unit of UNITS) {
        let used = 0;
        for (const cell of unit) if (grid.values[cell]) {
          if (used & bit(grid.values[cell])) return;
          used |= bit(grid.values[cell]);
        }
        for (const digit of digitsOf(511 & ~used)) {
          const places = unit.filter(cell => !grid.values[cell] && (grid.cands[cell] & bit(digit)));
          if (!places.length) return;
          if (places.length === 1) { setValue(grid, places[0], digit); changed = true; }
          else for (const other of UNITS) {
            if (other === unit || !places.every(cell => other.includes(cell))) continue;
            for (const cell of other) if (!unit.includes(cell) && !grid.values[cell] && (grid.cands[cell] & bit(digit))) {
              grid.cands[cell] &= ~bit(digit); changed = true;
            }
          }
        }
        const pairs = new Map<number, number[]>();
        for (const cell of unit) if (!grid.values[cell] && popcount(grid.cands[cell]) === 2) {
          const mask = grid.cands[cell]; pairs.set(mask, [...(pairs.get(mask) ?? []), cell]);
        }
        for (const [mask, pair] of pairs) if (pair.length === 2) {
          for (const cell of unit) if (!grid.values[cell] && !pair.includes(cell) && (grid.cands[cell] & mask)) {
            grid.cands[cell] &= ~mask; changed = true;
          }
        }
      }
    }
    if (isBroken(grid)) return;
    let target = -1;
    let best = Infinity;
    for (let cell = 0; cell < 81; cell++) if (!grid.values[cell]) {
      const score = popcount(grid.cands[cell]) * 100 - neighbors[cell].filter(i=>!grid.values[i]).length;
      if (score < best) { best = score; target = cell; }
    }
    if (target < 0) { count++; return; }
    for (const digit of digitsOf(grid.cands[target]).sort((a,b) => Number(b === knownSolution?.[target]) - Number(a === knownSolution?.[target]))) {
      const next = cloneGrid(grid); setValue(next, target, digit); search(next);
      if (count >= 2) return;
    }
  }
  search(emptyGrid());
  return count;
}

export interface DigProgress { tested: number; total: number; removed: number }
export function digCages(cages: Cage[], random = Math.random, deadline = Infinity, onProgress?: (progress: DigProgress) => void, knownSolution?: number[]) {
  if (countKillerSolutions(cages, deadline, knownSolution) !== 1) throw new Error('Digging requires a verified unique starting puzzle.');
  const order = [...cages];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let remaining = [...cages];
  for (let i = 0; i < order.length; i++) {
    onProgress?.({ tested: i, total: order.length, removed: cages.length - remaining.length });
    const trial = remaining.filter(c => c !== order[i]);
    if (countKillerSolutions(trial, deadline, knownSolution) === 1) remaining = trial;
  }
  // Removing more constraints cannot restore uniqueness to a rejected trial.
  // Thus one shuffled pass proves every retained cage is indispensable.
  const summary = { tested: order.length, total: order.length, removed: cages.length - remaining.length };
  onProgress?.(summary);
  return { cages: remaining, ...summary };
}
