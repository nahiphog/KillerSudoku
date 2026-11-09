import './style.css';
import './cages.css';
import { cageOptionsError, DEFAULT_CAGE_SIZES, type Cage } from './engine/cages';
import type { PuzzleOptions, VerifiedPuzzle } from './engine/verifiedGenerator';
import { DIFFICULTIES, DIFFICULTY_TECHNIQUES, type Difficulty } from './engine/difficulty';
import { header, footer, setupAbout } from './shell';
import { applyDeduction, startSolver, type Deduction, type SolverResult } from './engine/killerSolver';
import { cellName, digitsOf, type Grid } from './vendor/sudokui/board';
import './solver.css';
import { newManualBoard, enterManualDigit, eraseManualCell, manualStatus, moveSelection } from './engine/manualPlay';
import './manual.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${header}
  <main>
    <div class="workspace">
      <section class="board-panel" aria-labelledby="board-title">
        <div class="panel-heading"><h1 id="board-title">Your grid</h1><span class="badge" id="badge">READY TO GENERATE</span></div>
        <table class="board" role="grid" aria-label="Sudoku grid" aria-describedby="manual-help"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td role="gridcell" tabindex="-1" aria-label="Row ${r + 1}, column ${c + 1}, empty"></td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="board-footer"><span class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite">Generate a grid with cages to get started.</p></div>
        <div class="board-actions"><button id="toggle-solution" type="button" disabled>Hide solution</button><label><input id="show-candidates" type="checkbox" disabled> Show candidates</label></div>
        <div class="play-modes" aria-label="Board view"><button id="manual-view" type="button" aria-pressed="true" disabled>Play manually</button><button id="solver-view" type="button" aria-pressed="false" disabled>View solver</button></div>
        <section id="manual-controls" aria-label="Manual entry controls">
          <p id="manual-help">Select a cell, then use 1–9 or the number pad. Arrow keys move; P toggles pencil marks; Backspace, Delete or 0 erases.</p>
          <div class="entry-options"><button id="pencil-mode" type="button" aria-pressed="false" disabled>Pencil marks: off</button><button id="erase-entry" type="button" disabled>Erase</button></div>
          <div class="number-pad" aria-label="Number pad">${Array.from({ length: 9 }, (_, i) => `<button type="button" data-digit="${i + 1}" aria-label="Enter ${i + 1}" disabled>${i + 1}</button>`).join('')}</div>
          <p id="manual-message" role="status" aria-live="polite">Generate a puzzle to play.</p>
        </section>
      </section>
      <aside>
        <section class="generate-panel"><h2>Generate a puzzle grid</h2><p>Every puzzle is verified to have one solution and a complete logical solve using cage combinations and Sudoku techniques.</p>
          <fieldset id="settings"><legend>Generation settings</legend>
            <label class="difficulty-label" for="difficulty">Difficulty</label>
            <select id="difficulty" aria-describedby="difficulty-help">${DIFFICULTIES.map(level => `<option value="${level}">${level}</option>`).join('')}</select>
            <p class="setting-help" id="difficulty-help">Easy: cage combinations, cage remainders and singles.</p>
            <details class="difficulty-guide"><summary>How difficulty is rated</summary><p>The hardest technique used in the verified solve determines the level. Easier techniques are always tried first. Steps and cage sizes do not determine difficulty.</p>${DIFFICULTIES.map(level => `<p><strong>${level}:</strong> ${DIFFICULTY_TECHNIQUES[level].join(', ')}.</p>`).join('')}</details>
            <label class="symmetry-option"><input id="symmetry" type="checkbox" checked> Rotationally symmetric cages</label>
            <p class="setting-help">Cage shapes match after a 180° turn.</p>
            <fieldset class="size-options"><legend>Allowed cells per cage</legend>
              <div class="size-choices">${Array.from({ length: 8 }, (_, i) => i + 2).map(size => `<label><input type="checkbox" name="size" value="${size}" ${DEFAULT_CAGE_SIZES.includes(size) ? 'checked' : ''}><span>${size}</span></label>`).join('')}</div>
            </fieldset>
            <p class="setting-help">Only selected sizes will be used. Each cage has connected cells and no repeated digits.</p>
          </fieldset>
          <p id="settings-error" class="error" role="alert" hidden></p>
          <button id="generate" type="button"><span aria-hidden="true">↻</span> Generate <span class="button-arrow" aria-hidden="true">↗</span></button>
          <button id="cancel-generation" type="button" hidden>Cancel generation</button>
          <p class="hint">Settings apply to the next generated grid.</p>
        </section>
        <section class="solver-panel" aria-labelledby="solver-title"><h2 id="solver-title">Step-by-step solver</h2>
          <p>Start with cages and sums only. Each step explains a placement or a candidate elimination. The solver has its own board; your manual entries are preserved.</p>
          <div class="solver-actions"><button id="next-step" type="button" disabled>Next step</button><button id="undo-step" type="button" disabled>Undo step</button><button id="reset-solver" type="button" disabled>Reset solver</button></div>
          <p id="solver-message" role="status" aria-live="polite">Generate a grid to begin.</p>
          <ol id="step-history" reversed aria-label="Deduction history"></ol>
        </section>
      </aside>
    </div>
  </main>
  ${footer}`;
setupAbout();
const button = document.querySelector<HTMLButtonElement>('#generate')!;
const cancelGeneration = document.querySelector<HTMLButtonElement>('#cancel-generation')!;
const settings = document.querySelector<HTMLFieldSetElement>('#settings')!;
const status = document.querySelector('#status')!;
const errorText = document.querySelector<HTMLParagraphElement>('#settings-error')!;
const cells = [...document.querySelectorAll<HTMLTableCellElement>('.board td')];
let generation = 0;
let verifiedSteps = 0;
let verifiedDifficulty: Difficulty = 'Easy';
let hardestTechnique = '';
let worker: Worker | null = null;
let solution: number[] | null = null;
let activeCages: Cage[] = [];
let solvingGrid = startSolver();
let revealSolution = false;
let boardView: 'manual' | 'solver' = 'manual';
let manualBoard = newManualBoard();
let selectedCell = 0;
let pencilMode = false;
let solverWorker: Worker | null = null;
let solverStopped = false;
const history: { before: Grid; step: Deduction }[] = [];
const toggleSolution = document.querySelector<HTMLButtonElement>('#toggle-solution')!;
const candidateToggle = document.querySelector<HTMLInputElement>('#show-candidates')!;
const nextButton = document.querySelector<HTMLButtonElement>('#next-step')!;
const undoButton = document.querySelector<HTMLButtonElement>('#undo-step')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset-solver')!;
const solverMessage = document.querySelector('#solver-message')!;
const historyList = document.querySelector<HTMLOListElement>('#step-history')!;
const manualView = document.querySelector<HTMLButtonElement>('#manual-view')!;
const solverView = document.querySelector<HTMLButtonElement>('#solver-view')!;
const pencilButton = document.querySelector<HTMLButtonElement>('#pencil-mode')!;
const eraseButton = document.querySelector<HTMLButtonElement>('#erase-entry')!;
const numberButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-digit]')];
const manualMessage = document.querySelector('#manual-message')!;
function canEdit() { return !!solution && !worker && !solverWorker && !revealSolution && boardView === 'manual'; }
function updateSolverControls() {
  const busy = !!worker || !!solverWorker;
  toggleSolution.disabled = !solution || busy;
  candidateToggle.disabled = !solution || busy || revealSolution || boardView === 'manual';
  nextButton.disabled = !solution || busy || solverStopped;
  undoButton.disabled = !history.length || busy;
  resetButton.disabled = !solution || busy;
  toggleSolution.textContent = revealSolution ? 'Hide solution' : 'Show solution';
  toggleSolution.setAttribute('aria-pressed', String(!revealSolution));
  manualView.disabled = solverView.disabled = !solution || busy;
  manualView.setAttribute('aria-pressed', String(boardView === 'manual'));
  solverView.setAttribute('aria-pressed', String(boardView === 'solver'));
  pencilButton.disabled = eraseButton.disabled = !canEdit();
  for (const button of numberButtons) button.disabled = !canEdit();
  pencilButton.setAttribute('aria-pressed', String(pencilMode));
  pencilButton.textContent = `Pencil marks: ${pencilMode ? 'on' : 'off'}`;
  document.querySelector('#manual-controls')!.setAttribute('data-active', String(boardView === 'manual'));
  for (let i = 0; i < cells.length; i++) cells[i].tabIndex = solution && !busy && i === selectedCell ? 0 : -1;
}
function paint() {
  if (solution) renderBoard(revealSolution ? solution : boardView === 'manual' ? manualBoard.values : Array.from(solvingGrid.values), activeCages);
  updateSolverControls();
}
function updateManualMessage() {
  const { conflicts, complete } = manualStatus(manualBoard, activeCages);
  manualMessage.textContent = complete ? 'Puzzle solved! Every row, column, box and cage is correct.'
    : `${cellName(selectedCell)} selected · ${pencilMode ? 'pencil marks' : 'digit entry'} · ${manualBoard.values.filter(Boolean).length}/81 filled.${conflicts.size ? ' Red digits conflict with a Sudoku or cage rule.' : ''}`;
}
function selectCell(cell: number) {
  if (!solution || worker || solverWorker) return;
  selectedCell = cell; boardView = 'manual'; revealSolution = false;
  paint(); updateManualMessage(); cells[cell].focus({ preventScroll: true });
}
function enterDigit(digit: number) {
  if (!canEdit()) return;
  if (pencilMode && manualBoard.values[selectedCell]) {
    manualMessage.textContent = 'Erase the digit in this cell before adding pencil marks.'; return;
  }
  manualBoard = enterManualDigit(manualBoard, selectedCell, digit, pencilMode);
  paint(); updateManualMessage();
}
function eraseEntry() {
  if (!canEdit()) return;
  manualBoard = eraseManualCell(manualBoard, selectedCell); paint(); updateManualMessage();
}
function togglePencil() { if (canEdit()) { pencilMode = !pencilMode; updateSolverControls(); updateManualMessage(); } }
cells.forEach((cell, index) => {
  cell.addEventListener('click', () => selectCell(index));
  cell.addEventListener('focus', () => {
    if (selectedCell !== index) { selectedCell = index; paint(); if (solution) updateManualMessage(); }
  });
});
manualView.addEventListener('click', () => { boardView = 'manual'; revealSolution = false; paint(); updateManualMessage(); });
solverView.addEventListener('click', () => { boardView = 'solver'; revealSolution = false; paint(); });
pencilButton.addEventListener('click', togglePencil);
eraseButton.addEventListener('click', eraseEntry);
numberButtons.forEach(button => button.addEventListener('click', () => enterDigit(Number(button.dataset.digit))));
document.querySelector('.board-panel')!.addEventListener('keydown', event => {
  const key = event as KeyboardEvent;
  const target = key.target as HTMLElement;
  if (!solution || worker || solverWorker || key.ctrlKey || key.metaKey || key.altKey || key.isComposing
    || target.matches('input, select, textarea') || target.isContentEditable) return;
  if (target.matches('[role="gridcell"]') && (key.key.startsWith('Arrow') || key.key === 'Enter' || key.key === ' ')) {
    key.preventDefault(); selectCell(moveSelection(selectedCell, key.key)); return;
  }
  if (!canEdit()) return;
  if (/^[1-9]$/.test(key.key)) { key.preventDefault(); enterDigit(Number(key.key)); }
  else if (['Backspace', 'Delete', '0'].includes(key.key)) { key.preventDefault(); eraseEntry(); }
  else if (key.key.toLowerCase() === 'p') { key.preventDefault(); togglePencil(); }
});
function resetSolving() {
  solverWorker?.terminate(); solverWorker = null;
  solvingGrid = startSolver(); history.length = 0; solverStopped = false;
  historyList.replaceChildren();
  solverMessage.textContent = `Ready. ${verifiedDifficulty} · hardest technique: ${hardestTechnique}. Verified unique solution in ${verifiedSteps} logical steps. Next step starts from cages and sums only.`;
}
toggleSolution.addEventListener('click', () => {
  revealSolution = !revealSolution;
  if (!revealSolution) candidateToggle.checked = false;
  paint();
});
candidateToggle.addEventListener('change', paint);
resetButton.addEventListener('click', () => {
  resetSolving(); boardView = 'solver'; revealSolution = false; candidateToggle.checked = false; paint();
});
undoButton.addEventListener('click', () => {
  const previous = history.pop();
  if (!previous) return;
  solvingGrid = previous.before; solverStopped = false; revealSolution = false; boardView = 'solver';
  historyList.firstElementChild?.remove(); historyList.start = history.length;
  solverMessage.textContent = 'Last deduction undone. ' + history.length + ' steps applied.';
  paint();
});
nextButton.addEventListener('click', () => {
  revealSolution = false; boardView = 'solver'; candidateToggle.checked = true;
  solverMessage.textContent = 'Checking cage combinations and Sudoku techniques…';
  try {
    solverWorker = new Worker(new URL('./engine/solver.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    solverMessage.textContent = 'Unable to start the solver. Please reload and try again.';
    paint(); return;
  }
  paint(); validate();
  const finish = () => { solverWorker?.terminate(); solverWorker = null; paint(); validate(); };
  solverWorker.onmessage = (event: MessageEvent<SolverResult>) => {
    const result = event.data;
    if (result.status === 'step') {
      history.push({ before: solvingGrid, step: result.step });
      solvingGrid = applyDeduction(solvingGrid, activeCages, result.step);
      const item = document.createElement('li');
      const title = document.createElement('h3'); title.textContent = result.step.technique;
      const explanation = document.createElement('p'); explanation.textContent = result.step.description;
      const changes = document.createElement('p'); changes.className = 'deduction-changes';
      const removed = new Map<number, number[]>();
      for (const { cell, digit } of result.step.eliminations) removed.set(cell, [...(removed.get(cell) ?? []), digit]);
      changes.textContent = [
        ...result.step.placements.map(p => 'Place ' + p.digit + ' in ' + cellName(p.cell)),
        ...[...removed].map(([cell, digits]) => 'Remove ' + digits.join(', ') + ' from ' + cellName(cell)),
      ].join('; ') + '.';
      item.append(title, explanation, changes); historyList.prepend(item); historyList.start = history.length;
      solverMessage.textContent = 'Step ' + history.length + ': ' + result.step.technique + '. ' + Array.from(solvingGrid.values).filter(Boolean).length + '/81 cells placed.';
    } else { solverStopped = true; solverMessage.textContent = result.message; }
    finish();
  };
  solverWorker.onerror = () => { solverMessage.textContent = 'The solver could not complete this step. Please try again.'; finish(); };
  solverWorker.postMessage({ grid: solvingGrid, cages: activeCages });
});
const difficultySelect = document.querySelector<HTMLSelectElement>('#difficulty')!;
difficultySelect.addEventListener('change', () => {
  const level = difficultySelect.value as Difficulty;
  document.querySelector('#difficulty-help')!.textContent = `${level}: ${DIFFICULTY_TECHNIQUES[level].join(', ')}. Generation must match this level exactly.`;
});
const options = (): PuzzleOptions => ({
  difficulty: difficultySelect.value as Difficulty,
  symmetric: document.querySelector<HTMLInputElement>('#symmetry')!.checked,
  sizes: [...document.querySelectorAll<HTMLInputElement>('input[name="size"]:checked')].map(input => Number(input.value)),
});
function validate() {
  const selected = options();
  const error = cageOptionsError(selected) ?? (selected.sizes?.every(size => size === 9)
    ? 'Nine-cell cages all sum to 45 and cannot give a unique puzzle. Allow smaller cage sizes.' : null);
  errorText.textContent = error ?? '';
  errorText.hidden = !error;
  button.disabled = !!error || !!worker || !!solverWorker;
}
cancelGeneration.addEventListener('click', () => {
  worker?.terminate(); worker = null;
  settings.disabled = false; cancelGeneration.hidden = true;
  status.textContent = 'Generation cancelled. Your previous puzzle is unchanged.';
  validate(); updateSolverControls();
});
settings.addEventListener('change', validate);
function renderBoard(values: number[], cages: Cage[]) {
  const cageForCell = new Map(cages.flatMap(cage => cage.cells.map(cell => [cell, cage] as const)));
  const manual = !revealSolution && boardView === 'manual';
  const conflicts = manual ? manualStatus(manualBoard, cages).conflicts : new Set<number>();
  cells.forEach((cell, i) => {
    const cage = cageForCell.get(i)!;
    cell.replaceChildren();
    const digit = document.createElement('span');
    digit.className = 'cell-digit';
    digit.textContent = values[i] ? String(values[i]) : '';
    cell.append(digit);
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}, cage sum ${cage.sum}, ${cage.cells.length} cells`);
    cell.classList.toggle('deduction-cell', !revealSolution && boardView === 'solver' && !!history.at(-1)?.step.cells.includes(i));
    cell.classList.toggle('selected-cell', manual && selectedCell === i);
    cell.classList.toggle('conflict-cell', conflicts.has(i));
    cell.setAttribute('aria-selected', String(manual && selectedCell === i));
    if (conflicts.has(i)) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', rule conflict');
    if (!revealSolution && !values[i] && (manual ? !!manualBoard.notes[i] : candidateToggle.checked)) {
      const notes = document.createElement('span'); notes.className = 'cell-candidates';
      const candidates = digitsOf(manual ? manualBoard.notes[i] : solvingGrid.cands[i]);
      for (let d = 1; d <= 9; d++) {
        const mark = document.createElement('span'); mark.textContent = candidates.includes(d) ? String(d) : ''; notes.append(mark);
      }
      cell.append(notes);
      cell.setAttribute('aria-label', cell.getAttribute('aria-label') + (manual ? ', pencil marks ' : ', candidates ') + candidates.join(', '));
    }
    const outline = document.createElement('span');
    outline.className = 'cage-outline';
    outline.setAttribute('aria-hidden', 'true');
    const edges = {
      top: i < 9 || cageForCell.get(i - 9) !== cage,
      bottom: i >= 72 || cageForCell.get(i + 9) !== cage,
      left: i % 9 === 0 || cageForCell.get(i - 1) !== cage,
      right: i % 9 === 8 || cageForCell.get(i + 1) !== cage,
    };
    for (const [edge, boundary] of Object.entries(edges)) {
      outline.style.setProperty(edge, boundary ? '4px' : '-1px');
      if (boundary) outline.classList.add(`cage-${edge}`);
    }
    cell.append(outline);
    if (cage.cells[0] === i) {
      const label = document.createElement('span');
      label.className = 'cage-sum';
      label.textContent = String(cage.sum);
      label.setAttribute('aria-hidden', 'true');
      cell.append(label);
    }
  });
  document.querySelector('.board')!.classList.add('has-cages');
}
button.addEventListener('click', () => {
  validate();
  if (button.disabled) return;
  const selectedOptions = options();
  settings.disabled = true;
  button.disabled = true;
  status.textContent = `Searching for a ${selectedOptions.difficulty} puzzle and verifying every logical step…`;
  cancelGeneration.hidden = false;
  const cleanup = () => {
    worker?.terminate();
    worker = null;
    settings.disabled = false;
    cancelGeneration.hidden = true;
    validate();
    updateSolverControls();
  };
  const fail = (message: string) => {
    cleanup();
    errorText.textContent = message;
    errorText.hidden = false;
    status.textContent = 'Generation unsuccessful. Your previous grid has been kept.';
  };
  try {
    worker = new Worker(new URL('./engine/generation.worker.ts', import.meta.url), { type: 'module' });
    updateSolverControls();
    worker.onmessage = (event: MessageEvent<Partial<VerifiedPuzzle> & { error?: string; progress?: number }>) => {
      const { values, cages, error, progress, proofSteps, difficulty, hardestTechnique: hardest } = event.data;
      if (progress !== undefined) {
        status.textContent = `Checking candidate ${progress}: seeking ${selectedOptions.difficulty} difficulty with a complete logical solve.`;
        return;
      }
      if (error || !values || !cages || !proofSteps || !difficulty || difficulty !== selectedOptions.difficulty || !hardest) { fail(error ?? 'Unable to verify the requested difficulty. Try again.'); return; }
      verifiedSteps = proofSteps;
      verifiedDifficulty = difficulty; hardestTechnique = hardest;
      solution = values; activeCages = cages; resetSolving(); revealSolution = false; candidateToggle.checked = false;
      manualBoard = newManualBoard(); selectedCell = 0; pencilMode = false; boardView = 'manual';
      updateManualMessage();
      paint();
      generation++;
      document.querySelector('#badge')!.textContent = `${difficulty.toUpperCase()} · ${cages.length} CAGES`;
      status.textContent = `Puzzle ${generation} · ${difficulty} · hardest: ${hardest} · unique solution · ${proofSteps} logical steps verified.`;
      cleanup();
    };
    worker.onerror = () => fail('Unable to generate a grid. Please reload and try again.');
    worker.postMessage(selectedOptions);
  } catch { fail('Unable to start generation. Please reload and try again.'); }
});
