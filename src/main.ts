import './style.css';
import './cages.css';
import { cageOptionsError, DEFAULT_CAGE_SIZES, type Cage, type CageOptions } from './engine/cages';
import { header, footer, setupAbout } from './shell';
import { applyDeduction, startSolver, type Deduction, type SolverResult } from './engine/killerSolver';
import { cellName, digitsOf, type Grid } from './vendor/sudokui/board';
import './solver.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${header}
  <main>
    <div class="workspace">
      <section class="board-panel" aria-labelledby="board-title">
        <div class="panel-heading"><h1 id="board-title">Your grid</h1><span class="badge" id="badge">READY TO GENERATE</span></div>
        <table class="board" aria-label="Sudoku grid"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td aria-label="Row ${r + 1}, column ${c + 1}, empty"></td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="board-footer"><span class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite">Generate a grid with cages to get started.</p></div>
        <div class="board-actions"><button id="toggle-solution" type="button" disabled>Hide solution</button><label><input id="show-candidates" type="checkbox" disabled> Show candidates</label></div>
      </section>
      <aside>
        <section class="generate-panel"><h2>Generate a puzzle grid</h2><p>Every puzzle is verified to have one solution and a complete logical solve using cage combinations and Sudoku techniques.</p>
          <fieldset id="settings"><legend>Cage settings</legend>
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
          <p>Start with cages and sums only. Each step explains a placement or a candidate elimination.</p>
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
let worker: Worker | null = null;
let solution: number[] | null = null;
let activeCages: Cage[] = [];
let solvingGrid = startSolver();
let revealSolution = true;
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
function updateSolverControls() {
  const busy = !!worker || !!solverWorker;
  toggleSolution.disabled = !solution || busy;
  candidateToggle.disabled = !solution || busy || revealSolution;
  nextButton.disabled = !solution || busy || solverStopped;
  undoButton.disabled = !history.length || busy;
  resetButton.disabled = !solution || busy;
  toggleSolution.textContent = revealSolution ? 'Hide solution' : 'Show solution';
  toggleSolution.setAttribute('aria-pressed', String(!revealSolution));
}
function paint() {
  if (solution) renderBoard(revealSolution ? solution : Array.from(solvingGrid.values), activeCages);
  updateSolverControls();
}
function resetSolving() {
  solverWorker?.terminate(); solverWorker = null;
  solvingGrid = startSolver(); history.length = 0; solverStopped = false;
  historyList.replaceChildren();
  solverMessage.textContent = `Ready. Verified unique solution in ${verifiedSteps} logical steps. Next step starts from cages and sums only.`;
}
toggleSolution.addEventListener('click', () => {
  revealSolution = !revealSolution;
  if (!revealSolution) candidateToggle.checked = false;
  paint();
});
candidateToggle.addEventListener('change', paint);
resetButton.addEventListener('click', () => {
  resetSolving(); revealSolution = false; candidateToggle.checked = false; paint();
});
undoButton.addEventListener('click', () => {
  const previous = history.pop();
  if (!previous) return;
  solvingGrid = previous.before; solverStopped = false; revealSolution = false;
  historyList.firstElementChild?.remove(); historyList.start = history.length;
  solverMessage.textContent = 'Last deduction undone. ' + history.length + ' steps applied.';
  paint();
});
nextButton.addEventListener('click', () => {
  revealSolution = false; candidateToggle.checked = true;
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
const options = (): CageOptions => ({
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
  cells.forEach((cell, i) => {
    const cage = cageForCell.get(i)!;
    cell.replaceChildren();
    const digit = document.createElement('span');
    digit.className = 'cell-digit';
    digit.textContent = values[i] ? String(values[i]) : '';
    cell.append(digit);
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}, cage sum ${cage.sum}, ${cage.cells.length} cells`);
    cell.classList.toggle('deduction-cell', !revealSolution && !!history.at(-1)?.step.cells.includes(i));
    if (!revealSolution && !values[i] && candidateToggle.checked) {
      const notes = document.createElement('span'); notes.className = 'cell-candidates';
      const candidates = digitsOf(solvingGrid.cands[i]);
      for (let d = 1; d <= 9; d++) {
        const mark = document.createElement('span'); mark.textContent = candidates.includes(d) ? String(d) : ''; notes.append(mark);
      }
      cell.append(notes);
      cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', candidates ' + candidates.join(', '));
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
  status.textContent = 'Searching for a uniquely solvable puzzle and verifying every logical step…';
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
    worker.onmessage = (event: MessageEvent<{ values?: number[]; cages?: Cage[]; error?: string; progress?: number; proofSteps?: number }>) => {
      const { values, cages, error, progress, proofSteps } = event.data;
      if (progress !== undefined) {
        status.textContent = `Checking candidate ${progress}: verifying a complete logical solve. Only verified puzzles are accepted.`;
        return;
      }
      if (error || !values || !cages || !proofSteps) { fail(error ?? 'Unable to verify a puzzle. Try again.'); return; }
      verifiedSteps = proofSteps;
      solution = values; activeCages = cages; resetSolving(); revealSolution = true; candidateToggle.checked = false;
      paint();
      generation++;
      document.querySelector('#badge')!.textContent = `${cages.length} CAGES`;
      status.textContent = `Puzzle ${generation} · ${cages.length} ${selectedOptions.symmetric ? 'symmetric' : 'connected'} cages · unique solution · ${proofSteps} logical steps verified.`;
      cleanup();
    };
    worker.onerror = () => fail('Unable to generate a grid. Please reload and try again.');
    worker.postMessage(selectedOptions);
  } catch { fail('Unable to start generation. Please reload and try again.'); }
});
