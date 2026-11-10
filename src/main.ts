import './style.css';
import './cages.css';
import { cageOptionsError, DEFAULT_CAGE_SIZES, type Cage } from './engine/cages';
import type { PuzzleOptions, VerifiedPuzzle } from './engine/verifiedGenerator';
import { header, footer, setupAbout } from './shell';
import { applyDeduction, startSolver, type Deduction } from './engine/killerSolver';
import { cellName, digitsOf, type Grid } from './vendor/sudokui/board';
import './solver.css';
import { drawWalkthroughLinks } from './walkthroughLinks';
import { scoredTally } from './engine/techniqueScores';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${header.replace('<button id="about"', '<button id="open-settings" type="button" aria-haspopup="dialog">Settings</button><button id="about"')}
  <div class="generation-toolbar"><div class="generation-actions"><button id="generate" type="button">↻ Generate</button><label class="symmetry-option"><input id="dig-cages" type="checkbox" checked> Dig cages after generation</label><label class="symmetry-option"><input id="dig-pairs" type="checkbox" checked> Dig cages in pairs</label><p>Cage options are available in Settings.</p></div><dl id="generation-summary" aria-label="Generated puzzle details" hidden></dl></div>
  <main>
    <div class="workspace">
      <section class="board-panel" aria-labelledby="board-title">
        <div class="panel-heading"><h1 id="board-title">Your grid</h1><span class="badge" id="badge">READY TO GENERATE</span></div>
        <div class="board-stage">
        <div class="grid-frame"><table class="board" role="grid" aria-label="Sudoku grid" aria-readonly="true"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td role="gridcell" tabindex="-1" aria-label="Row ${r + 1}, column ${c + 1}, empty"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="walkthrough-controls">          <div class="solver-actions"><button id="next-step" type="button" disabled>Next step</button><button id="undo-step" type="button" disabled>Undo step</button><button id="reset-solver" type="button" disabled>Reset solver</button></div>
          <label for="walkthrough">Solution walkthrough</label><input id="walkthrough" type="range" min="0" max="0" value="0" step="1" disabled aria-describedby="walkthrough-position"><output id="walkthrough-position" for="walkthrough">Step 0 of 0</output>
          <div class="change-legend"><span class="placed-digit">Placed digit</span><span class="removed-candidate">Removed candidate</span><span class="support-digit">Supporting cells / digits</span></div>
          <div id="link-legend" hidden><span class="strong-key">Solid: at least one true</span><span class="weak-key">Dashed: cannot both be true</span></div>
</div>
        </div>
        <div class="board-footer"><span class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite">Generate a grid with cages to get started.</p></div>
        <div class="board-actions"><button id="toggle-solution" type="button" disabled>Hide solution</button><label><input id="show-candidates" type="checkbox" disabled> Show candidates</label></div>
      </section>
      <aside>
        <section id="deduction-panel" class="solver-panel" aria-label="Current deduction" hidden>
          <p id="solver-message" role="status" aria-live="polite"></p>
          <ol id="step-history" reversed aria-label="Deduction history"></ol>
        </section>
        <p id="settings-error" class="error" role="alert" hidden></p>
        <section class="solver-panel" aria-labelledby="statistics-title"><h2 id="statistics-title">Puzzle statistics</h2>
          <table id="technique-tally" aria-label="Technique usage" hidden><thead><tr><th scope="col">Technique</th><th scope="col">Rating</th><th scope="col">Steps</th></tr></thead><tbody></tbody></table>
        </section>

      </aside>
    </div>
  </main>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><h2 id="settings-title">Settings</h2><p>Changes apply to the next generated puzzle. Any difficulty is accepted; every puzzle must still have a verified unique solution.</p>
          <fieldset id="settings"><legend>Generation settings</legend>
            <label class="symmetry-option"><input id="symmetry" type="checkbox" checked> Rotationally symmetric cages</label>
            <p class="setting-help">Cage shapes match after a 180° turn.</p>
            <fieldset class="size-options"><legend>Allowed cells per cage</legend>
              <div class="size-choices">${Array.from({ length: 8 }, (_, i) => i + 2).map(size => `<label><input type="checkbox" name="size" value="${size}" ${DEFAULT_CAGE_SIZES.includes(size) ? 'checked' : ''}><span>${size}</span></label>`).join('')}</div>
            </fieldset>
            <p class="setting-help">Only selected sizes will be used. Each cage has connected cells and no repeated digits.</p>
          </fieldset>
<p id="cage-settings-error" class="error" role="alert" hidden></p><form method="dialog"><button autofocus>Done</button></form></dialog>
  ${footer}`;
setupAbout();
const settingsDialog = document.querySelector<HTMLDialogElement>('#settings-dialog')!;
document.querySelector('#open-settings')!.addEventListener('click', () => settingsDialog.showModal());
settingsDialog.addEventListener('click', event => {
  if (event.target !== settingsDialog) return;
  const bounds = settingsDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) settingsDialog.close();
});
const button = document.querySelector<HTMLButtonElement>('#generate')!;
const pairToggle = document.querySelector<HTMLInputElement>('#dig-pairs')!;
const settings = document.querySelector<HTMLFieldSetElement>('#settings')!;
const digToggle = document.querySelector<HTMLInputElement>('#dig-cages')!;
const status = document.querySelector('#status')!;
const errorText = document.querySelector<HTMLParagraphElement>('#settings-error')!;
const cells = [...document.querySelectorAll<HTMLTableCellElement>('.board td')];
const gridFrame = document.querySelector<HTMLElement>('.grid-frame')!;
new ResizeObserver(() => renderLinks()).observe(gridFrame);
function renderLinks() {
  const links = !revealSolution ? history[walkthroughPosition - 1]?.step.links ?? [] : [];
  drawWalkthroughLinks(gridFrame, links);
  document.querySelector<HTMLElement>('#link-legend')!.hidden = !links.length;
}
let generation = 0;
let worker: Worker | null = null;
let solution: number[] | null = null;
let activeCages: Cage[] = [];
let solvingGrid = startSolver();
let revealSolution = false;
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
function updateSolverControls() {
  const busy = !!worker;
  digToggle.disabled = busy;
  pairToggle.disabled = busy || !digToggle.checked || !document.querySelector<HTMLInputElement>('#symmetry')!.checked;
  button.textContent = busy ? 'Cancel generation' : '↻ Generate';
  if (busy) button.disabled = false;
  toggleSolution.disabled = !solution || busy;
  candidateToggle.disabled = !solution || busy || revealSolution;
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
  for (const stepButton of document.querySelectorAll<HTMLButtonElement>('[data-step]')) stepButton.disabled = busy;
}
function paint() {
  document.querySelector('.board-panel')!.setAttribute('data-view', 'solver');
  if (solution) renderBoard(revealSolution ? solution : Array.from(solvingGrid.values), activeCages);
  updateSolverControls();
}
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
  document.querySelector<HTMLElement>('#deduction-panel')!.hidden = !current;
  solverMessage.textContent = current ? 'Step ' + walkthroughPosition + ' of ' + history.length + ' · ' + Array.from(solvingGrid.values).filter(Boolean).length + '/81 cells placed.' : '';
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
  revealSolution = false; candidateToggle.checked = true;
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
const options = (): PuzzleOptions => ({
  dig: digToggle.checked,
  digPairs: pairToggle.checked,
  symmetric: document.querySelector<HTMLInputElement>('#symmetry')!.checked,
  sizes: [...document.querySelectorAll<HTMLInputElement>('input[name="size"]:checked')].map(input => Number(input.value)),
});
function validate() {
  const selected = options();
  const error = cageOptionsError(selected) ?? (selected.sizes?.every(size => size === 9)
    ? 'Nine-cell cages all sum to 45 and cannot give a unique puzzle. Allow smaller cage sizes.' : null);
  errorText.textContent = error ?? '';
  errorText.hidden = !error;
  const dialogError = document.querySelector<HTMLElement>('#cage-settings-error')!;
  dialogError.textContent = error ?? ''; dialogError.hidden = !error;
  button.disabled = !!error && !worker;
  updateSolverControls();
}
function cancelGeneration() {
  worker?.terminate(); worker = null;
  settings.disabled = false;
  status.textContent = 'Generation cancelled. Your previous puzzle is unchanged.';
  validate(); updateSolverControls();
}
settings.addEventListener('change', validate);
digToggle.addEventListener('change', updateSolverControls);
function renderBoard(values: number[], cages: Cage[]) {
  const cageForCell = new Map(cages.flatMap(cage => cage.cells.map(cell => [cell, cage] as const)));
  const currentStep = !revealSolution ? history[walkthroughPosition - 1]?.step : undefined;
  const beforeStep = currentStep ? (walkthroughPosition > 1 ? history[walkthroughPosition - 2].after : startSolver()) : undefined;
  cells.forEach((cell, i) => {
    const cage = cageForCell.get(i);
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
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}, ${cage ? `cage sum ${cage.sum}, ${cage.cells.length} cells` : 'no cage'}`);
    cell.classList.toggle('deduction-cell', !revealSolution && !!history[walkthroughPosition - 1]?.step.cells.includes(i));
    if (placed) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', placed this step');
    if (currentStep?.supportCells.includes(i)) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', supporting cell');
    if (supporting.length) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', supporting digits: ' + supporting.join(', '));
    if (!revealSolution && !values[i] && (candidateToggle.checked || removed.length > 0 || supporting.length > 0)) {
      const notes = document.createElement('span'); notes.className = 'cell-candidates';
      const candidates = digitsOf(candidateToggle.checked ? solvingGrid.cands[i] : 0);
      for (let d = 1; d <= 9; d++) {
        const mark = document.createElement('span');
        mark.dataset.cell = String(i); mark.dataset.digit = String(d);
        mark.textContent = candidates.includes(d) || removed.includes(d) || supporting.includes(d) ? String(d) : '';
        mark.classList.toggle('removed-candidate', removed.includes(d));
        mark.classList.toggle('support-digit', !removed.includes(d) && supporting.includes(d));
        notes.append(mark);
      }
      cell.append(notes);
      cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', candidates ' + candidates.join(', '));
    }
    if (removed.length) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', removed this step: ' + removed.join(', '));
    if (!cage) return;
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
  if (worker) { cancelGeneration(); return; }
  validate();
  if (button.disabled) return;
  const selectedOptions = options();
  settings.disabled = true;
  button.disabled = true;
  status.textContent = `Searching for a puzzle and verifying every logical step…`;
  const cleanup = () => {
    worker?.terminate();
    worker = null;
    settings.disabled = false;
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
    worker.onmessage = (event: MessageEvent<Partial<VerifiedPuzzle> & { error?: string; progress?: number; diggingProgress?: { tested: number; total: number; removed: number } }>) => {
      const { values, cages, error, progress, proofSteps, difficulty, hardestTechnique: hardest, deductions, techniqueTally, elapsedMilliseconds, attempts, digging, diggingProgress, logicallySolved: complete } = event.data;
      if (diggingProgress) {
        status.textContent = 'Digging: testing cage ' + Math.min(diggingProgress.tested + 1, diggingProgress.total) + ' of ' + diggingProgress.total + ' · ' + diggingProgress.removed + ' removed.';
        return;
      }
      if (progress !== undefined) {
        status.textContent = `Checking candidate ${progress}: verifying a unique solution and complete logical solve.`;
        return;
      }
      if (error || !values || !cages || proofSteps === undefined || complete === undefined || !difficulty || !hardest || !deductions || deductions.length !== proofSteps || !techniqueTally || elapsedMilliseconds === undefined) { fail(error ?? 'Unable to verify the puzzle. Try again.'); return; }
      acceptPuzzle(event.data as VerifiedPuzzle);
      cleanup();
    };
    worker.onerror = () => fail('Unable to generate a grid. Please reload and try again.');
    worker.postMessage(selectedOptions);
  } catch { fail('Unable to start generation. Please reload and try again.'); }
});

function acceptPuzzle(puzzle: VerifiedPuzzle, custom = false) {
  const { values, cages, proofSteps, difficulty, hardestTechnique: hardest, deductions, techniqueTally, elapsedMilliseconds, attempts, digging, logicallySolved: complete } = puzzle;
  const tally = document.querySelector<HTMLTableElement>('#technique-tally')!;
  tally.hidden = false;
  const body = tally.tBodies[0]; body.replaceChildren();
  const scores = scoredTally(techniqueTally);
  for (const { technique, rating } of scores) {
    const row = body.insertRow();
    const name = document.createElement('th'); name.scope = 'row'; name.textContent = technique;
    row.append(name);
    row.insertCell().textContent = String(rating);
    const stepsCell = row.insertCell(); stepsCell.className = 'technique-steps';
    deductions.forEach((step, index) => {
      if (step.technique !== technique) return;
      const stepButton = document.createElement('button');
      stepButton.type = 'button'; stepButton.dataset.step = String(index + 1);
      stepButton.textContent = String(index + 1);
      stepButton.setAttribute('aria-label', 'View step ' + (index + 1) + ': ' + technique);
      stepButton.addEventListener('click', () => seekWalkthrough(index + 1));
      stepsCell.append(stepButton);
    });
  }
  const summary = document.querySelector<HTMLElement>('#generation-summary')!;
  summary.replaceChildren(); summary.hidden = false;
  const totalRating = scores.reduce((sum, row) => sum + row.score, 0);
  for (const [label, value] of [['Cages', String(cages.length)], ['Generation time', (elapsedMilliseconds / 1000).toFixed(2) + ' s'], ['Difficulty', difficulty], ['Difficulty rating', totalRating.toLocaleString()]]) {
    const group = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    group.append(term, detail); summary.append(group);
  }
  solution = values; activeCages = cages; resetSolving(deductions); revealSolution = false; candidateToggle.checked = false;
  paint();
  generation++;
  document.querySelector('#board-title')!.textContent = custom ? 'Custom grid' : digging ? 'Dug-killer grid' : 'Your grid';
  document.querySelector('#badge')!.textContent = `${custom ? 'CUSTOM' : digging ? 'DUG-KILLER' : difficulty.toUpperCase()} · ${cages.length} CAGES`;
  status.textContent = `Puzzle ${generation} · ${difficulty} · hardest: ${hardest} · unique solution · ${proofSteps} walkthrough steps${techniqueTally['Brute Force'] ? ' · Brute Force uses: ' + techniqueTally['Brute Force'] : ''}.`;
}

if (new URLSearchParams(location.search).get('custom') === '1') {
  try {
    const stored = sessionStorage.getItem('custom-puzzle');
    if (!stored) throw new Error('No custom puzzle is available.');
    acceptPuzzle(JSON.parse(stored) as VerifiedPuzzle, true);
  } catch {
    status.textContent = 'Unable to load the custom puzzle. Return to Custom Build and generate a new puzzle.';
  }
}
