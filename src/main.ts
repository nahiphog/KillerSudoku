import { importButton, setupGridImport } from './gridImportDialog';
import { cageLegend } from './cageLegend';
import { exportControls, setupGridExport, visibleGrid, serializeGrid } from './gridExport';
import { generationTimer } from './generationTimer';
import { customEntryGrid } from './engine/customEntries';
import './style.css';
import './cages.css';
import { cageOptionsError, DEFAULT_CAGE_SIZES, type Cage, type CageArithmetic, cageSymbol } from './engine/cages';
import { retainedCageSizesError, type PuzzleOptions, type VerifiedPuzzle } from './engine/verifiedGenerator';
import { header, footer, setupAbout } from './shell';
import { applyDeduction, revealedCageOperations, startSolver, type Deduction } from './engine/killerSolver';
import { cellName, digitsOf, type Grid } from './vendor/sudokui/board';
import './solver.css';
import { drawWalkthroughLinks } from './walkthroughLinks';
import { scoredTally } from './engine/techniqueScores';
import { readSimulationWalkthrough } from './simulationWalkthrough';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${header.replace('<button id="about"', '<button id="open-settings" type="button" aria-haspopup="dialog">Settings</button><button id="about"')}
  <div class="generation-toolbar"><div class="generation-actions"><button id="generate" type="button">↻ Generate</button>${importButton}<label class="symmetry-option">Cage arithmetic <select id="cage-operation" aria-label="Cage arithmetic"><option value="sum">Sum</option><option value="product">Product</option><option value="mixed">Sum + Product</option><option value="psycho">Psycho</option></select></label><fieldset id="retained-cage-sizes"><legend>Allowed cells per cage</legend>${Array.from({length:9},(_,i)=>i+1).map(size=>`<label>${size} ${size === 1 ? 'cell' : 'cells'} <select name="cage-size" data-size="${size}" aria-label="${size}-cell cages"><option value="none">None</option><option value="required" ${DEFAULT_CAGE_SIZES.includes(size) ? 'selected' : ''}>At least 1</option></select></label>`).join('')}</fieldset><label class="symmetry-option"><input id="dig-cages" type="checkbox" checked> Dig cages after generation</label><label class="symmetry-option"><input id="dig-pairs" type="checkbox" checked> Dig cages in pairs</label><label class="symmetry-option" title="Remove every 1-cell cage, overriding its retention minimum. Retry until the remaining puzzle meets the solution requirements."><input id="dig-singletons" type="checkbox"> Dig out all 1-cell cages</label><label class="symmetry-option"><input id="logic-only" type="checkbox" checked title="Applies to the next generated puzzle. Every cell must be solvable with logical techniques; digging must preserve this complete solve."> Require a complete logical solve</label></div><p id="generation-live" role="timer" hidden></p><dl id="generation-summary" aria-label="Generated puzzle details" hidden></dl></div>
  <main>
    <div class="workspace generation-workspace">
      <section class="board-panel" aria-labelledby="board-title">
        <div class="panel-heading"><h1 id="board-title">Your grid</h1><span class="badge" id="badge">READY TO GENERATE</span></div>
        <div class="board-stage">
        <div class="grid-frame"><table class="board" role="grid" aria-label="Sudoku grid" aria-readonly="true"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td role="gridcell" tabindex="-1" aria-label="Row ${r + 1}, column ${c + 1}, empty"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${cageLegend}
        <div class="walkthrough-controls">          <div class="solver-actions"><button id="next-step" type="button" disabled>Next step</button><button id="undo-step" type="button" disabled>Undo step</button><button id="reset-solver" type="button" disabled>Reset solver</button></div>
          <label for="walkthrough">Solution walkthrough</label><input id="walkthrough" type="range" min="0" max="0" value="0" step="1" disabled aria-describedby="walkthrough-position"><output id="walkthrough-position" for="walkthrough">Step 0 of 0</output>
          <div class="change-legend"><span class="placed-digit">Placed digit</span><span class="removed-candidate">Removed candidate</span><span class="support-digit">Supporting cells / digits</span></div>
          <div id="link-legend" hidden><span class="strong-key">Solid: at least one true</span><span class="weak-key">Dashed: cannot both be true</span></div>
</div>
        </div>
        <div class="board-footer"><span class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite">Generate a grid with cages to get started.</p></div>
        ${exportControls}<button id="edit-custom" type="button" disabled>Edit in Custom Build</button><div class="board-actions"><button id="toggle-solution" type="button" disabled>Hide solution</button><label><input id="show-candidates" type="checkbox" disabled> Show candidates</label></div>
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
const retainedCageSizes = document.querySelector<HTMLFieldSetElement>('#retained-cage-sizes')!;
const singletonToggle = document.querySelector<HTMLInputElement>('#dig-singletons')!;
const pairToggle = document.querySelector<HTMLInputElement>('#dig-pairs')!;
const settings = document.querySelector<HTMLFieldSetElement>('#settings')!;
const digToggle = document.querySelector<HTMLInputElement>('#dig-cages')!;
const logicOnlyToggle = document.querySelector<HTMLInputElement>('#logic-only')!;
const status = document.querySelector('#status')!;
const liveTimer = generationTimer(document.querySelector<HTMLElement>('#generation-live')!);
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
let loadingSimulation = false;
let solution: number[] | null = null;
let editablePuzzle: VerifiedPuzzle | null = null;
let activeCages: Cage[] = [];
let exportedCageFreeCells: number[] = [];
let restoredNotes: number[] | null = null;
let initialGrid = startSolver();
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
const updateExportControls = setupGridExport(document.querySelector<HTMLElement>('.board')!, () => visibleGrid(document.querySelector<HTMLElement>('.board')!, activeCages, exportedCageFreeCells));
updateExportControls(false);
function updateSolverControls() {
  const busy = !!worker;
  document.querySelector<HTMLButtonElement>('#open-import')!.disabled = busy;
  updateExportControls(!!solution && !busy);
  document.querySelector<HTMLButtonElement>('#edit-custom')!.disabled = !editablePuzzle || busy;
  document.querySelector<HTMLSelectElement>('#cage-operation')!.disabled = busy;
  digToggle.disabled = busy;
  singletonToggle.disabled = busy || !digToggle.checked || !selectedCageSizes().includes(1);
  retainedCageSizes.disabled = busy;
  logicOnlyToggle.disabled = busy;
  pairToggle.disabled = busy || !digToggle.checked || !document.querySelector<HTMLInputElement>('#symmetry')!.checked;
  button.textContent = busy ? loadingSimulation ? 'Cancel walkthrough' : 'Cancel generation' : '↻ Generate';
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
  let grid = initialGrid;
  for (const step of deductions) {
    grid = applyDeduction(grid, activeCages, step);
    history.push({ after: grid, step });
  }
  walkthroughPosition = 0; solvingGrid = initialGrid;
  renderWalkthrough();
}
function renderWalkthrough() {
  historyList.replaceChildren();
  const current = history[walkthroughPosition - 1];
  const stalled = !!solution && walkthroughPosition === history.length && Array.from(solvingGrid.values).some(value => !value);
  document.querySelector<HTMLElement>('#deduction-panel')!.hidden = !current && !stalled;
  solverMessage.textContent = current ? 'Step ' + walkthroughPosition + ' of ' + history.length + ' · ' + Array.from(solvingGrid.values).filter(Boolean).length + '/81 cells placed.' : '';
  if (stalled) solverMessage.textContent += ' No further logical steps are available. The puzzle still has a verified unique solution.';
  if (!current) return;
  historyList.start = walkthroughPosition;
  const item = document.createElement('li');
  const title = document.createElement('h3'); title.textContent = current.step.technique;
  const explanation = document.createElement('p'); explanation.textContent = current.step.description;
  const changes = document.createElement('p'); changes.className = 'deduction-changes';
  const removed = new Map<number, number[]>();
  for (const { cell, digit } of current.step.eliminations) removed.set(cell, [...(removed.get(cell) ?? []), digit]);
  changes.textContent = [
    ...(current.step.cageOperation ? ['Identify the cage at '+cellName(current.step.cageOperation.cell)+' as '+current.step.cageOperation.operation] : []),
    ...current.step.placements.map(p => 'Place ' + p.digit + ' in ' + cellName(p.cell)),
    ...[...removed].map(([cell, digits]) => 'Remove ' + digits.join(', ') + ' from ' + cellName(cell)),
  ].join('; ') + '.';
  item.append(title, explanation, changes); historyList.append(item);
}
function seekWalkthrough(position: number) {
  if (!solution || worker) return;
  walkthroughPosition = Math.max(0, Math.min(history.length, Math.round(position)));
  solvingGrid = walkthroughPosition ? history[walkthroughPosition - 1].after : initialGrid;
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
const selectedCageSizes = () => [...document.querySelectorAll<HTMLSelectElement>('select[name="cage-size"]')].filter(input=>input.value === 'required').map(input=>Number(input.dataset.size));
const options = (): PuzzleOptions => ({
  dig: digToggle.checked,
  digSingletons: singletonToggle.checked,
  operation: document.querySelector<HTMLSelectElement>('#cage-operation')!.value as CageArithmetic,
  retainedCageSizes: selectedCageSizes(),
  logicOnly: logicOnlyToggle.checked,
  digPairs: pairToggle.checked,
  symmetric: document.querySelector<HTMLInputElement>('#symmetry')!.checked,
  sizes: selectedCageSizes(),
});
function validate() {
  const selected = options();
  const error = cageOptionsError(selected) ?? retainedCageSizesError(selected) ?? (selected.sizes?.every(size => size === 9)
    ? 'Nine-cell cages all contain digits 1–9 and cannot give a unique puzzle. Allow smaller cage sizes.' : null);
  errorText.textContent = error ?? '';
  errorText.hidden = !error;
  const dialogError = document.querySelector<HTMLElement>('#cage-settings-error')!;
  dialogError.textContent = error ?? ''; dialogError.hidden = !error;
  button.disabled = !!error && !worker;
  updateSolverControls();
}
function cancelGeneration() {
  liveTimer.stop();
  worker?.terminate(); worker = null;
  settings.disabled = false;
  status.textContent = loadingSimulation ? 'Walkthrough loading cancelled.' : 'Generation cancelled. Your previous puzzle is unchanged.';
  loadingSimulation = false;
  validate(); updateSolverControls();
}
settings.addEventListener('change', validate);
digToggle.addEventListener('change', validate);
singletonToggle.addEventListener('change', validate);
retainedCageSizes.addEventListener('change', validate);
function renderBoard(values: number[], cages: Cage[]) {
  const cageForCell = new Map(cages.flatMap(cage => cage.cells.map(cell => [cell, cage] as const)));
  const operations=revealedCageOperations(history.map(item=>item.step),walkthroughPosition);
  const currentStep = !revealSolution ? history[walkthroughPosition - 1]?.step : undefined;
  const beforeStep = currentStep ? (walkthroughPosition > 1 ? history[walkthroughPosition - 2].after : initialGrid) : undefined;
  cells.forEach((cell, i) => {
    const cage = cageForCell.get(i);
    const revealedOperation=cage?.operation==='psycho' ? operations.get(Math.min(...cage.cells)) : undefined;
    cell.dataset.cageOperation = revealedOperation ?? cage?.operation ?? 'sum';
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
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}, ${cage ? `cage ${cage.operation ?? 'sum'} ${cage.sum}, ${cage.cells.length} cells` : 'no cage'}`);
    if(revealedOperation)cell.setAttribute('aria-label',cell.getAttribute('aria-label')+', deduced '+revealedOperation+' operation');
    cell.classList.toggle('deduction-cell', !revealSolution && !!history[walkthroughPosition - 1]?.step.cells.includes(i));
    if (placed) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', placed this step');
    if (currentStep?.supportCells.includes(i)) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', supporting cell');
    if (supporting.length) cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', supporting digits: ' + supporting.join(', '));
    if (!revealSolution && !values[i] && (candidateToggle.checked || removed.length > 0 || supporting.length > 0)) {
      const notes = document.createElement('span'); notes.className = 'cell-candidates';
      const candidates = digitsOf(candidateToggle.checked ? (walkthroughPosition === 0 && restoredNotes ? restoredNotes[i] : solvingGrid.cands[i]) : 0);
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
      label.textContent = String(cage.sum) + cageSymbol(revealedOperation ?? cage.operation);
      if(revealedOperation)label.title='Deduced '+revealedOperation+' operation';
      if(cage.sum>=10000) label.style.fontSize='10px';
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
  liveTimer.start();
  settings.disabled = true;
  button.disabled = true;
  status.textContent = `Searching for a puzzle and verifying every logical step…`;
  const cleanup = () => {
    liveTimer.stop();
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
    worker.onmessage = (event: MessageEvent<Partial<VerifiedPuzzle> & { error?: string; progress?: number; diggingProgress?: { tested: number; total: number; removed: number; pass?: number } }>) => {
      const { values, cages, error, progress, proofSteps, difficulty, hardestTechnique: hardest, deductions, techniqueTally, elapsedMilliseconds, attempts, digging, diggingProgress, logicallySolved: complete } = event.data;
      if (diggingProgress) {
        status.textContent = 'Digging' + (diggingProgress.pass && diggingProgress.pass > 1 ? ' (pass ' + diggingProgress.pass + ')' : '') + ': testing cage ' + Math.min(diggingProgress.tested + 1, diggingProgress.total) + ' of ' + diggingProgress.total + ' · ' + diggingProgress.removed + ' removed.';
        return;
      }
      if (progress !== undefined) {
        liveTimer.setAttempts(progress);
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
  editablePuzzle = puzzle;
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
  for (const [label, value] of [['Cages', String(cages.length)], ['Generation time', (elapsedMilliseconds / 1000).toFixed(2) + ' s'], ['Difficulty rating', totalRating.toLocaleString()], ['Hardest technique', hardest], ['Uncaged cells', String(81 - new Set(cages.flatMap(cage=>cage.cells)).size)]]) {
    const group = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    group.append(term, detail); summary.append(group);
  }
  document.body.classList.toggle('dug-grid-page', !!digging && !custom);
  restoredNotes = puzzle.entries?.notes ?? null;
  exportedCageFreeCells = puzzle.cageFreeCells ?? [];
  solution = values; activeCages = cages; initialGrid = customEntryGrid(puzzle.entries, cages.map(c => c.cells)); resetSolving(deductions); revealSolution = false; candidateToggle.checked = !!puzzle.entries?.notes.some(Boolean);
  paint();
  generation++;
  document.querySelector('#board-title')!.textContent = custom ? 'Custom grid' : digging ? 'Dug-killer grid' : 'Your grid';
  document.querySelector('#badge')!.textContent = `${custom ? 'CUSTOM' : digging ? 'DUG-KILLER' : difficulty.toUpperCase()} · ${cages.length} CAGES`;
  status.textContent = `Puzzle ${generation} · ${difficulty} · hardest: ${hardest} · unique solution · ${proofSteps} walkthrough steps${techniqueTally['Brute Force'] ? ' · Brute Force uses: ' + techniqueTally['Brute Force'] : !complete ? ' · partial logical walkthrough' : ''}.`;
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

setupGridImport(puzzle=>{
  acceptPuzzle(puzzle,true);
  document.querySelector('#board-title')!.textContent='Imported grid';
  document.querySelector('#badge')!.textContent='IMPORTED · '+puzzle.cages.length+' CAGES';
  document.querySelector('#status')!.textContent='Imported grid · verified unique solution · '+puzzle.proofSteps+' walkthrough steps.';
});

document.querySelector('#edit-custom')!.addEventListener('click',()=>{
  if(!editablePuzzle || worker) return;
  try {
    sessionStorage.setItem('edit-grid',serializeGrid({cages:editablePuzzle.cages,values:editablePuzzle.entries?.values ?? Array(81).fill(0),notes:(editablePuzzle.entries?.notes ?? Array(81).fill(0)).map(digitsOf),cageFreeCells:editablePuzzle.cageFreeCells}));
    location.href='./custom.html?edit=1';
  } catch {status.textContent='Browser storage is unavailable. Enable session storage to edit this grid.';}
});

function loadSimulationWalkthrough() {
  const finish = () => {worker?.terminate();worker=null;loadingSimulation=false;settings.disabled=false;validate();updateSolverControls();};
  const fail = (message: string) => {finish();status.textContent=message;errorText.textContent=message;errorText.hidden=false;};
  try {
    const request=readSimulationWalkthrough(location.hash);
    if(!request)return;
    loadingSimulation=true;settings.disabled=true;
    status.textContent=`Preparing solution walkthrough for simulation trial ${request.trial}…`;
    worker=new Worker(new URL('./engine/import.worker.ts',import.meta.url),{type:'module'});
    updateSolverControls();
    worker.onmessage=(event:MessageEvent<{puzzle?:VerifiedPuzzle;error?:string}>)=>{
      const puzzle=event.data.puzzle;
      if(!puzzle){fail(event.data.error ?? 'Unable to prepare this simulation walkthrough.');return;}
      finish();
      acceptPuzzle({...puzzle,elapsedMilliseconds:request.elapsedMilliseconds},true);
      document.querySelector('#board-title')!.textContent=`Simulation trial ${request.trial}`;
      document.querySelector('#badge')!.textContent=`SIMULATION · ${puzzle.cages.length} CAGES`;
      status.textContent=`Simulation trial ${request.trial} · verified unique solution · ${puzzle.proofSteps} walkthrough steps${puzzle.techniqueTally['Brute Force'] ? ' · Brute Force uses: '+puzzle.techniqueTally['Brute Force'] : ''}.`;
      document.querySelector('#board-title')!.scrollIntoView({block:'start'});
    };
    worker.onerror=()=>fail('Unable to prepare this simulation walkthrough. Reload to try again.');
    worker.postMessage(request.grid);
  }catch(error){fail(error instanceof Error ? error.message : 'Invalid simulation grid link.');}
}
loadSimulationWalkthrough();
