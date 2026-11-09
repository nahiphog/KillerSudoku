import './style.css';
import './cages.css';
import { cageOptionsError, DEFAULT_CAGE_SIZES, type Cage } from './engine/cages';
import type { PuzzleOptions, VerifiedPuzzle } from './engine/verifiedGenerator';
import { DIFFICULTIES, DIFFICULTY_TECHNIQUES, type Difficulty } from './engine/difficulty';
import { header, footer, setupAbout } from './shell';
import { applyDeduction, startSolver, type Deduction } from './engine/killerSolver';
import { cellName, digitsOf, type Grid } from './vendor/sudokui/board';
import './solver.css';
import { newManualBoard, enterManualDigit, eraseManualCell, manualStatus, moveSelection } from './engine/manualPlay';
import './manual.css';
import { drawWalkthroughLinks } from './walkthroughLinks';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${header}
  <div class="generation-toolbar"><button id="generate" type="button">↻ Generate</button><button id="cancel-generation" type="button" hidden>Cancel generation</button><p>Uses the generation settings below.</p></div>
  <main>
    <div class="workspace">
      <section class="board-panel" aria-labelledby="board-title">
        <div class="panel-heading"><h1 id="board-title">Your grid</h1><span class="badge" id="badge">READY TO GENERATE</span></div>
        <div class="board-stage">
        <div class="grid-frame"><table class="board" role="grid" aria-label="Sudoku grid" aria-describedby="manual-help"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td role="gridcell" tabindex="-1" aria-label="Row ${r + 1}, column ${c + 1}, empty"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="walkthrough-controls">          <div class="solver-actions"><button id="next-step" type="button" disabled>Next step</button><button id="undo-step" type="button" disabled>Undo step</button><button id="reset-solver" type="button" disabled>Reset solver</button></div>
          <label for="walkthrough">Solution walkthrough</label><input id="walkthrough" type="range" min="0" max="0" value="0" step="1" disabled aria-describedby="walkthrough-position"><output id="walkthrough-position" for="walkthrough">Step 0 of 0</output>
          <div class="change-legend"><span class="placed-digit">Placed digit</span><span class="removed-candidate">Removed candidate</span><span class="support-digit">Supporting cells / digits</span></div>
          <div id="link-legend" hidden><span class="strong-key">Solid: at least one true</span><span class="weak-key">Dashed: cannot both be true</span></div>
</div>
        </div>
        <section class="solver-panel" aria-labelledby="solver-title"><h2 id="solver-title">Step-by-step solver</h2>
          <p>Start with cages and sums only. Each step explains a placement or a candidate elimination. The solver has its own board; your manual entries are preserved.</p>
          <p id="solver-message" role="status" aria-live="polite">Generate a grid to begin.</p>
          <ol id="step-history" reversed aria-label="Deduction history"></ol>
        </section>
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
          <p class="hint">Settings apply to the next generated grid.</p>
        </section>
        <section class="solver-panel" aria-labelledby="statistics-title"><h2 id="statistics-title">Puzzle statistics</h2>
          <p id="construction-time">Generate a puzzle to see construction time and technique counts.</p>
          <p>Counts cover the complete verified solution, one count per deduction.</p>
          <table id="technique-tally" hidden><caption>Techniques used in the full solve</caption><thead><tr><th scope="col">Technique</th><th scope="col">Steps</th></tr></thead><tbody></tbody><tfoot><tr><th scope="row">Total</th><td id="tally-total"></td></tr></tfoot></table>
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
const gridFrame = document.querySelector<HTMLElement>('.grid-frame')!;
new ResizeObserver(() => renderLinks()).observe(gridFrame);
function renderLinks() {
  const links = !revealSolution && boardView === 'solver' ? history[walkthroughPosition - 1]?.step.links ?? [] : [];
  drawWalkthroughLinks(gridFrame, links);
  document.querySelector<HTMLElement>('#link-legend')!.hidden = !links.length;
}
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
let walkthroughPosition = 0;
const history: { after: Grid; step: Deduction }[] = [];
const walkthrough = document.querySelector<HTMLInputElement>('#walkthrough')!;
const walkthroughOutput = document.querySelector('#walkthrough-position')!;
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
function canEdit() { return !!solution && !worker && !revealSolution && boardView === 'manual'; }
function updateSolverControls() {
  const busy = !!worker;
  toggleSolution.disabled = !solution || busy;
  candidateToggle.disabled = !solution || busy || revealSolution || boardView === 'manual';
  nextButton.disabled = !solution || busy || walkthroughPosition === history.length;
  undoButton.disabled = walkthroughPosition === 0 || busy;
  walkthrough.disabled = !solution || busy;
  walkthrough.max = String(history.length);
  walkthrough.value = String(walkthroughPosition);
  walkthrough.setAttribute('aria-valuetext', `Step ${walkthroughPosition} of ${history.length}`);
  walkthroughOutput.textContent = `Step ${walkthroughPosition} of ${history.length}`;
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
  document.querySelector('.board-panel')!.setAttribute('data-view', boardView);
  if (solution) renderBoard(revealSolution ? solution : boardView === 'manual' ? manualBoard.values : Array.from(solvingGrid.values), activeCages);
  updateSolverControls();
}
function updateManualMessage() {
  const { conflicts, complete } = manualStatus(manualBoard, activeCages);
  manualMessage.textContent = complete ? 'Puzzle solved! Every row, column, box and cage is correct.'
    : `${cellName(selectedCell)} selected · ${pencilMode ? 'pencil marks' : 'digit entry'} · ${manualBoard.values.filter(Boolean).length}/81 filled.${conflicts.size ? ' Red digits conflict with a Sudoku or cage rule.' : ''}`;
}
function selectCell(cell: number) {
  if (!solution || worker) return;
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
  if (!solution || worker || key.ctrlKey || key.metaKey || key.altKey || key.isComposing
    || target.matches('input, select, textarea') || target.isContentEditable) return;
  if (target.matches('[role="gridcell"]') && (key.key.startsWith('Arrow') || key.key === 'Enter' || key.key === ' ')) {
    key.preventDefault(); selectCell(moveSelection(selectedCell, key.key)); return;
  }
  if (!canEdit()) return;
  if (/^[1-9]$/.test(key.key)) { key.preventDefault(); enterDigit(Number(key.key)); }
  else if (['Backspace', 'Delete', '0'].includes(key.key)) { key.preventDefault(); eraseEntry(); }
  else if (key.key.toLowerCase() === 'p') { key.preventDefault(); togglePencil(); }
});
function resetSolving(deductions: Deduction[]) {
  history.length = 0;
  let grid = startSolver();
  for (const step of deductions) {
    grid = applyDeduction(grid, activeCages, step);
    history.push({ after: grid, step });
  }
  walkthroughPosition = 0; solvingGrid = startSolver();
  renderWalkthrough();
}
function renderWalkthrough() {
  historyList.replaceChildren();
  const current = history[walkthroughPosition - 1];
  solverMessage.textContent = current
    ? 'Step ' + walkthroughPosition + ' of ' + history.length + ': ' + current.step.technique + '. ' + Array.from(solvingGrid.values).filter(Boolean).length + '/81 cells placed.' + (walkthroughPosition === history.length ? ' Puzzle solved using logic only.' : '')
    : 'Ready. ' + verifiedDifficulty + ' · hardest technique: ' + hardestTechnique + '. Verified unique solution in ' + verifiedSteps + ' logical steps. Move the slider or choose Next step.';
  if (!current) return;
  historyList.start = walkthroughPosition;
  const item = document.createElement('li');
  const title = document.createElement('h3'); title.textContent = current.step.technique;
  const explanation = document.createElement('p'); explanation.textContent = current.step.description;
  const changes = document.createElement('p'); changes.className = 'deduction-changes';
  const removed = new Map<number, number[]>();
  for (const { cell, digit } of current.step.eliminations) removed.set(cell, [...(removed.get(cell) ?? []), digit]);
  changes.textContent = [
    ...current.step.placements.map(p => 'Place ' + p.digit + ' in ' + cellName(p.cell)),
    ...[...removed].map(([cell, digits]) => 'Remove ' + digits.join(', ') + ' from ' + cellName(cell)),
  ].join('; ') + '.';
  item.append(title, explanation, changes); historyList.append(item);
}
function seekWalkthrough(position: number) {
  if (!solution || worker) return;
  walkthroughPosition = Math.max(0, Math.min(history.length, Math.round(position)));
  solvingGrid = walkthroughPosition ? history[walkthroughPosition - 1].after : startSolver();
  boardView = 'solver'; revealSolution = false; candidateToggle.checked = true;
  renderWalkthrough(); paint();
}
walkthrough.addEventListener('input', () => seekWalkthrough(Number(walkthrough.value)));
toggleSolution.addEventListener('click', () => {
  revealSolution = !revealSolution;
  if (!revealSolution) candidateToggle.checked = false;
  paint();
});
candidateToggle.addEventListener('change', paint);
resetButton.addEventListener('click', () => seekWalkthrough(0));
undoButton.addEventListener('click', () => seekWalkthrough(walkthroughPosition - 1));
nextButton.addEventListener('click', () => seekWalkthrough(walkthroughPosition + 1));
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
  button.disabled = !!error || !!worker;
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
  const currentStep = !revealSolution && boardView === 'solver' ? history[walkthroughPosition - 1]?.step : undefined;
  const beforeStep = currentStep ? (walkthroughPosition > 1 ? history[walkthroughPosition - 2].after : startSolver()) : undefined;
  const conflicts = manual ? manualStatus(manualBoard, cages).conflicts : new Set<number>();
  cells.forEach((cell, i) => {
    const cage = cageForCell.get(i)!;
    cell.replaceChildren();
    const digit = document.createElement('span');
    digit.className = 'cell-digit';
    digit.textContent = values[i] ? String(values[i]) : '';
    if (values[i]) { digit.dataset.cell = String(i); digit.dataset.digit = String(values[i]); }
    const placed = !!currentStep?.placements.some(p => p.cell === i && p.digit === values[i]);
    digit.classList.toggle('placed-digit', placed);
    const supporting = currentStep?.supportDigits.filter(item => item.cell === i).map(item => item.digit) ?? [];
    digit.classList.toggle('support-digit', !placed && supporting.includes(values[i]));
    cell.classList.toggle('support-cell', !!currentStep?.supportCells.includes(i));
    // Include peer candidates removed automatically when a digit is placed.
    const removed = beforeStep && !values[i] ? digitsOf(beforeStep.cands[i] & ~solvingGrid.cands[i]) : [];
    cell.append(digit);
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}, cage sum ${cage.sum}, ${cage.cells.length} cells`);
    cell.classList.toggle('deduction-cell', !revealSolution && boardView === 'solver' && !!history[walkthroughPosition - 1]?.step.cells.includes(i));
    cell.classList.toggle('selected-cell', manual && selectedCell === i);
    cell.classList.toggle('conflict-cell', conflicts.has(i));
    cell.setAttribute('aria-selected', String(manual && selectedCell === i));
    if (conflicts.has(i)) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', rule conflict');
    if (placed) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', placed this step');
    if (currentStep?.supportCells.includes(i)) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', supporting cell');
    if (supporting.length) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', supporting digits: ' + supporting.join(', '));
    if (!revealSolution && !values[i] && (manual ? !!manualBoard.notes[i] : candidateToggle.checked || removed.length > 0 || supporting.length > 0)) {
      const notes = document.createElement('span'); notes.className = 'cell-candidates';
      const candidates = digitsOf(manual ? manualBoard.notes[i] : candidateToggle.checked ? solvingGrid.cands[i] : 0);
      for (let d = 1; d <= 9; d++) {
        const mark = document.createElement('span');
        mark.dataset.cell = String(i); mark.dataset.digit = String(d);
        mark.textContent = candidates.includes(d) || removed.includes(d) || supporting.includes(d) ? String(d) : '';
        mark.classList.toggle('removed-candidate', removed.includes(d));
        mark.classList.toggle('support-digit', !removed.includes(d) && supporting.includes(d));
        notes.append(mark);
      }
      cell.append(notes);
      cell.setAttribute('aria-label', cell.getAttribute('aria-label') + (manual ? ', pencil marks ' : ', candidates ') + candidates.join(', '));
    }
    if (removed.length) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', removed this step: ' + removed.join(', '));
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
  renderLinks();
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
      const { values, cages, error, progress, proofSteps, difficulty, hardestTechnique: hardest, deductions, techniqueTally, elapsedMilliseconds, attempts } = event.data;
      if (progress !== undefined) {
        status.textContent = `Checking candidate ${progress}: seeking ${selectedOptions.difficulty} difficulty with a complete logical solve.`;
        return;
      }
      if (error || !values || !cages || !proofSteps || !difficulty || difficulty !== selectedOptions.difficulty || !hardest || !deductions || deductions.length !== proofSteps || !techniqueTally || elapsedMilliseconds === undefined) { fail(error ?? 'Unable to verify the requested difficulty. Try again.'); return; }
      document.querySelector('#construction-time')!.textContent = 'Constructed and logically verified in ' + (elapsedMilliseconds / 1000).toFixed(2) + ' seconds · ' + attempts + ' candidate puzzles checked.';
      const tally = document.querySelector<HTMLTableElement>('#technique-tally')!;
      tally.hidden = false;
      const body = tally.tBodies[0]; body.replaceChildren();
      for (const [technique, count] of Object.entries(techniqueTally)) {
        const row = body.insertRow();
        const name = document.createElement('th'); name.scope = 'row'; name.textContent = technique;
        row.append(name); row.insertCell().textContent = String(count);
      }
      document.querySelector('#tally-total')!.textContent = String(proofSteps);
      verifiedSteps = proofSteps;
      verifiedDifficulty = difficulty; hardestTechnique = hardest;
      solution = values; activeCages = cages; resetSolving(deductions); revealSolution = false; candidateToggle.checked = false;
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
