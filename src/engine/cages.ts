import { UNITS } from '../vendor/sudokui/board';

export interface Cage { cells: number[]; sum: number }
export interface CageOptions { sizes?: readonly number[]; symmetric?: boolean }
export const DEFAULT_CAGE_SIZES = [2, 3, 4, 5, 6, 7];

export function orthogonalNeighbors(cell: number): number[] {
  const neighbors: number[] = [];
  if (cell >= 9) neighbors.push(cell - 9);
  if (cell < 72) neighbors.push(cell + 9);
  if (cell % 9 > 0) neighbors.push(cell - 1);
  if (cell % 9 < 8) neighbors.push(cell + 1);
  return neighbors;
}
const neighbors = Array.from({ length: 81 }, (_, i) => orthogonalNeighbors(i));
function totals(sizes: readonly number[]): boolean[] {
  const possible = Array<boolean>(82).fill(false);
  possible[0] = true;
  for (let n = 1; n <= 81; n++) possible[n] = sizes.some(s => n >= s && possible[n - s]);
  return possible;
}
export function cageOptionsError(options: CageOptions): string | null {
  const sizes = options.sizes ?? DEFAULT_CAGE_SIZES;
  if (!sizes.length) return 'Select at least one cage size.';
  if (sizes.some(s => !Number.isInteger(s) || s < 2 || s > 9)) return 'Cage sizes must be between 2 and 9.';
  const possible = totals(sizes);
  if (!possible[81]) return 'These cage sizes cannot cover 81 cells. Include another size.';
  if ((options.symmetric ?? true) && !sizes.some(s => s % 2 === 1 && possible[(81 - s) / 2])) {
    return 'Rotational symmetry needs an odd-sized central cage and matching pairs around it. Choose another size.';
  }
  return null;
}

/** Bounded backtracking: place whole cages (and their rotations) atomically. */
export function generateCages(values: ArrayLike<number>, optionsOrRandom: CageOptions | (() => number) = {}, rng = Math.random): Cage[] {
  const options = typeof optionsOrRandom === 'function' ? {} : optionsOrRandom;
  const random = typeof optionsOrRandom === 'function' ? optionsOrRandom : rng;
  if (values.length !== 81 || Array.from(values).some(v => !Number.isInteger(v) || v < 1 || v > 9)
    || UNITS.some(unit => new Set(unit.map(i => values[i])).size !== 9)) {
    throw new Error('Cage generation requires a valid completed Sudoku grid.');
  }
  const error = cageOptionsError(options);
  if (error) throw new Error(error);
  const sizes = [...new Set(options.sizes ?? DEFAULT_CAGE_SIZES)];
  const symmetric = options.symmetric ?? true;
  const possible = totals(sizes);
  const maxSize = Math.max(...sizes);
  const free = new Set(Array.from({ length: 81 }, (_, i) => i));
  const groups: number[][] = [];
  let budget = 25000;
  const shuffle = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  const distinct = (cells: number[]) => new Set(cells.map(i => values[i])).size === cells.length;
  // Every remaining connected component must admit a sum of allowed sizes.
  function viable(): boolean {
    const unseen = new Set(free);
    for (const first of unseen) {
      const component = [first];
      unseen.delete(first);
      for (const cell of component) for (const next of neighbors[cell]) {
        if (unseen.delete(next)) component.push(next);
      }
      if (!possible[component.length]) return false;
    }
    return true;
  }
  function search(): boolean {
    if (!free.size) return true;
    if (--budget <= 0) return false;
    const central = symmetric && free.has(40);
    const anchor = central ? 40 : Math.min(...free);
    const seen = new Set<string>();
    const targetSizes = shuffle(sizes.filter(s => !central || s % 2 === 1));
    function grow(shape: number[], target: number): boolean {
      if (--budget <= 0) return false;
      const key = shape.slice().sort((a, b) => a - b).join(',');
      if (seen.has(target + ':' + key)) return false;
      seen.add(target + ':' + key);
      if (shape.length === target) {
        const rotated = shape.map(i => 80 - i);
        const batch = symmetric && !central ? [shape, rotated] : [shape];
        for (const cage of batch) for (const i of cage) free.delete(i);
        groups.push(...batch);
        if (viable() && search()) return true;
        groups.splice(groups.length - batch.length);
        for (const cage of batch) for (const i of cage) free.add(i);
        return false;
      }
      if (shape.length >= target || shape.length >= maxSize) return false;
      const frontier = shuffle([...new Set(shape.flatMap(i => neighbors[i]))]);
      for (const next of frontier) {
        if (!free.has(next) || shape.includes(next)) continue;
        const expanded = central ? [...shape, next, 80 - next] : [...shape, next];
        if (new Set(expanded).size !== expanded.length || expanded.length > target || !distinct(expanded)) continue;
        if (symmetric && !central) {
          const rotated = expanded.map(i => 80 - i);
          if (rotated.some(i => !free.has(i) || expanded.includes(i)) || !distinct(rotated)) continue;
        }
        if (grow(expanded, target)) return true;
      }
      return false;
    }
    return targetSizes.some(size => grow([anchor], size));
  }
  const finish = (partition: number[][]) => partition.map(cells => ({
    cells: cells.slice().sort((a, b) => a - b),
    sum: cells.reduce((sum, i) => sum + values[i], 0),
  })).sort((a, b) => a.cells[0] - b.cells[0]);
  if (search()) return finish(groups);
  // Guaranteed valid layouts when these sizes were explicitly selected.
  const stripe = sizes.includes(3) ? 3 : sizes.includes(9) ? 9 : null;
  if (stripe) return finish(Array.from({ length: 81 / stripe }, (_, i) =>
    Array.from({ length: stripe }, (_, j) => i * stripe + j)));
  throw new Error('No cage layout found for this grid within the search limit. Try again or allow more cage sizes.');
}
