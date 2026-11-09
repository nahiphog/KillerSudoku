import { UNITS } from '../vendor/sudokui/board';

export interface Cage {
  /** Sorted, zero-based cell indexes; the first cell carries the sum label. */
  cells: number[];
  sum: number;
}

export function orthogonalNeighbors(cell: number): number[] {
  const neighbors: number[] = [];
  if (cell >= 9) neighbors.push(cell - 9);
  if (cell < 72) neighbors.push(cell + 9);
  if (cell % 9 > 0) neighbors.push(cell - 1);
  if (cell % 9 < 8) neighbors.push(cell + 1);
  return neighbors;
}

/** Partition a completed Sudoku into connected cages of 2–5 distinct digits. */
export function generateCages(values: ArrayLike<number>, random = Math.random): Cage[] {
  if (values.length !== 81 || Array.from(values).some(v => !Number.isInteger(v) || v < 1 || v > 9)
    || UNITS.some(unit => new Set(unit.map(i => values[i])).size !== 9)) {
    throw new Error('Cage generation requires a valid completed Sudoku grid.');
  }
  const shuffled = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  const finish = (groups: number[][]): Cage[] => groups
    .map(cells => ({ cells: cells.slice().sort((a, b) => a - b), sum: cells.reduce((s, i) => s + values[i], 0) }))
    .sort((a, b) => a.cells[0] - b.cells[0]);

  // Grow singletons into neighboring groups. Restart if a leftover cell cannot
  // join without duplicating a digit; never return a partition with singletons.
  for (let attempt = 0; attempt < 100; attempt++) {
    const groups = Array.from({ length: 81 }, (_, i) => [i]);
    const owner = Array.from({ length: 81 }, (_, i) => i);
    const merge = (a: number, b: number): boolean => {
      if (a === b || groups[a].length + groups[b].length > 5) return false;
      const digits = new Set(groups[a].map(i => values[i]));
      if (groups[b].some(i => digits.has(values[i]))) return false;
      for (const cell of groups[b]) { groups[a].push(cell); owner[cell] = a; }
      groups[b] = [];
      return true;
    };
    for (const cell of shuffled(Array.from({ length: 81 }, (_, i) => i))) {
      if (groups[owner[cell]].length !== 1) continue;
      for (const neighbor of shuffled(orthogonalNeighbors(cell))) {
        if (merge(owner[cell], owner[neighbor])) break;
      }
    }
    if (groups.some(cells => cells.length === 1)) continue;
    // Occasionally join adjacent small cages for more varied shapes and sizes.
    for (const cell of shuffled(Array.from({ length: 81 }, (_, i) => i))) {
      if (random() >= 0.15) continue;
      for (const neighbor of shuffled(orthogonalNeighbors(cell))) {
        if (merge(owner[cell], owner[neighbor])) break;
      }
    }
    return finish(groups.filter(cells => cells.length > 0));
  }
  // Bounded, guaranteed fallback even with an adversarial random source:
  // horizontal triples are connected and distinct in every valid Sudoku.
  return finish(Array.from({ length: 27 }, (_, i) => [3 * i, 3 * i + 1, 3 * i + 2]));
}
