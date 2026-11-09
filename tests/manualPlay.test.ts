import { describe, expect, it } from 'vitest';
import { enterManualDigit, eraseManualCell, manualStatus, moveSelection, newManualBoard } from '../src/engine/manualPlay';
import { bit, UNITS } from '../src/vendor/sudokui/board';

describe('manual play', () => {
  it('places and replaces digits without changing the previous board', () => {
    const blank = newManualBoard();
    const noted = enterManualDigit(blank, 0, 3, true);
    const filled = enterManualDigit(noted, 0, 5, false);
    expect(blank.notes[0]).toBe(0);
    expect(noted.notes[0]).toBe(bit(3));
    expect(filled.notes[0]).toBe(0);
    expect(filled.values[0]).toBe(5);
    expect(enterManualDigit(filled, 0, 8, false).values[0]).toBe(8);
    expect(enterManualDigit(filled, 0, 2, true)).toBe(filled);
  });
  it('toggles individual pencil marks and erases notes or entries', () => {
    let board = enterManualDigit(newManualBoard(), 10, 2, true);
    board = enterManualDigit(board, 10, 7, true);
    board = enterManualDigit(board, 10, 2, true);
    expect(board.notes[10]).toBe(bit(7));
    expect(eraseManualCell(board, 10).notes[10]).toBe(0);
    const filled = enterManualDigit(board, 10, 9, false);
    expect(eraseManualCell(filled, 10).values[10]).toBe(0);
    expect(filled.values[10]).toBe(9);
  });
  it('ignores invalid input', () => {
    const board = newManualBoard();
    expect(enterManualDigit(board, -1, 1, false)).toBe(board);
    expect(enterManualDigit(board, 81, 1, false)).toBe(board);
    expect(enterManualDigit(board, 0, 0, false)).toBe(board);
    expect(eraseManualCell(board, 81)).toBe(board);
  });
  it('moves by arrows without wrapping at board edges', () => {
    expect(moveSelection(0, 'ArrowLeft')).toBe(0);
    expect(moveSelection(8, 'ArrowRight')).toBe(8);
    expect(moveSelection(0, 'ArrowUp')).toBe(0);
    expect(moveSelection(80, 'ArrowDown')).toBe(80);
    expect(moveSelection(40, 'ArrowLeft')).toBe(39);
    expect(moveSelection(40, 'ArrowRight')).toBe(41);
    expect(moveSelection(40, 'ArrowUp')).toBe(31);
    expect(moveSelection(40, 'ArrowDown')).toBe(49);
  });
  it.each([1, 9, 10])('detects Sudoku duplicates at cell %i', other => {
    const board = newManualBoard(); board.values[0] = board.values[other] = 3;
    expect([...manualStatus(board, []).conflicts]).toEqual([0, other]);
  });
  it('checks cage duplicates and sums without consulting an answer', () => {
    const board = newManualBoard(); board.values[0] = board.values[40] = 3;
    expect(manualStatus(board, [{ cells: [0, 40], sum: 6 }]).conflicts.size).toBe(2);
    board.values[40] = 4;
    expect(manualStatus(board, [{ cells: [0, 40], sum: 7 }]).conflicts.size).toBe(0);
    expect(manualStatus(board, [{ cells: [0, 40], sum: 8 }]).conflicts.size).toBe(2);
    board.values[40] = 0;
    expect(manualStatus(board, [{ cells: [0, 40], sum: 3 }]).conflicts.has(0)).toBe(true);
  });
  it('recognizes a completed valid board and rejects an incomplete one', () => {
    const board = newManualBoard();
    const cages = UNITS.slice(0, 9).map(cells => ({ cells, sum: 45 }));
    expect(manualStatus(board, cages).complete).toBe(false);
    board.values = Array.from({ length: 81 }, (_, i) => (Math.floor(i / 9) * 3 + Math.floor(i / 27) + i % 9) % 9 + 1);
    expect(manualStatus(board, cages).complete).toBe(true);
    board.values[0] = 2;
    expect(manualStatus(board, cages).complete).toBe(false);
  });
});
