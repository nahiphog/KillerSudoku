import { bit, UNITS } from '../vendor/sudokui/board';
import type { Cage } from './cages';

export interface ManualBoard { values: number[]; notes: number[] }
export const newManualBoard = (): ManualBoard => ({ values: Array(81).fill(0), notes: Array(81).fill(0) });

export function enterManualDigit(board: ManualBoard, cell: number, digit: number, pencil: boolean): ManualBoard {
  if (!Number.isInteger(cell) || cell < 0 || cell >= 81 || !Number.isInteger(digit) || digit < 1 || digit > 9) return board;
  if (pencil && board.values[cell]) return board;
  const next = { values: board.values.slice(), notes: board.notes.slice() };
  if (pencil) next.notes[cell] ^= bit(digit);
  else { next.values[cell] = digit; next.notes[cell] = 0; }
  return next;
}

export function eraseManualCell(board: ManualBoard, cell: number): ManualBoard {
  if (!Number.isInteger(cell) || cell < 0 || cell >= 81) return board;
  const next = { values: board.values.slice(), notes: board.notes.slice() };
  next.values[cell] = 0; next.notes[cell] = 0;
  return next;
}

/** Checks visible rules only, never the stored answer. */
export function manualStatus(board: ManualBoard, cages: Cage[]): { conflicts: Set<number>; complete: boolean } {
  const conflicts = new Set<number>();
  for (const unit of [...UNITS, ...cages.map(cage => cage.cells)]) {
    for (const cell of unit) if (board.values[cell] && unit.some(other => other !== cell && board.values[other] === board.values[cell])) conflicts.add(cell);
  }
  for (const cage of cages) {
    const sum = cage.cells.reduce((total, cell) => cage.operation === 'product' ? total * (board.values[cell] || 1) : total + board.values[cell], cage.operation === 'product' ? 1 : 0);
    const full = cage.cells.every(cell => board.values[cell] !== 0);
    if (sum > cage.sum || (full && sum !== cage.sum) || (!full && (cage.operation === 'product' ? cage.sum % sum !== 0 : sum === cage.sum))) {
      cage.cells.filter(cell => board.values[cell]).forEach(cell => conflicts.add(cell));
    }
  }
  return { conflicts, complete: !!cages.length && board.values.every(digit => digit >= 1 && digit <= 9) && !conflicts.size };
}

export function moveSelection(cell: number, key: string): number {
  if (key === 'ArrowLeft') return cell % 9 ? cell - 1 : cell;
  if (key === 'ArrowRight') return cell % 9 < 8 ? cell + 1 : cell;
  if (key === 'ArrowUp') return cell >= 9 ? cell - 9 : cell;
  if (key === 'ArrowDown') return cell < 72 ? cell + 9 : cell;
  return cell;
}
