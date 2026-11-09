import './style.css';
import './cages.css';
import { cageOptionsError, DEFAULT_CAGE_SIZES, type Cage, type CageOptions } from './engine/cages';
import { header, footer, setupAbout } from './shell';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${header}
  <main>
    <div class="workspace">
      <section class="board-panel" aria-labelledby="board-title">
        <div class="panel-heading"><h1 id="board-title">Your grid</h1><span class="badge" id="badge">READY TO GENERATE</span></div>
        <table class="board" aria-label="Sudoku grid"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td aria-label="Row ${r + 1}, column ${c + 1}, empty"></td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="board-footer"><span class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite">Generate a grid with cages to get started.</p></div>
      </section>
      <aside>
        <section class="generate-panel"><h2>Generate a puzzle grid</h2><p>Create a completed Sudoku grid and a fresh cage layout together.</p>
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
          <p class="hint">Settings apply to the next generated grid.</p>
        </section>
      </aside>
    </div>
  </main>
  ${footer}`;
setupAbout();
const button = document.querySelector<HTMLButtonElement>('#generate')!;
const settings = document.querySelector<HTMLFieldSetElement>('#settings')!;
const status = document.querySelector('#status')!;
const errorText = document.querySelector<HTMLParagraphElement>('#settings-error')!;
const cells = [...document.querySelectorAll<HTMLTableCellElement>('.board td')];
let generation = 0;
let worker: Worker | null = null;
const options = (): CageOptions => ({
  symmetric: document.querySelector<HTMLInputElement>('#symmetry')!.checked,
  sizes: [...document.querySelectorAll<HTMLInputElement>('input[name="size"]:checked')].map(input => Number(input.value)),
});
function validate() {
  const error = cageOptionsError(options());
  errorText.textContent = error ?? '';
  errorText.hidden = !error;
  button.disabled = !!error || !!worker;
}
settings.addEventListener('change', validate);
function renderBoard(values: number[], cages: Cage[]) {
  const cageForCell = new Map(cages.flatMap(cage => cage.cells.map(cell => [cell, cage] as const)));
  cells.forEach((cell, i) => {
    const cage = cageForCell.get(i)!;
    cell.replaceChildren();
    const digit = document.createElement('span');
    digit.className = 'cell-digit';
    digit.textContent = String(values[i]);
    cell.append(digit);
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i]}, cage sum ${cage.sum}, ${cage.cells.length} cells`);
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
  status.textContent = 'Generating a completed grid and matching cages…';
  const cleanup = () => {
    worker?.terminate();
    worker = null;
    settings.disabled = false;
    validate();
  };
  const fail = (message: string) => {
    cleanup();
    errorText.textContent = message;
    errorText.hidden = false;
    status.textContent = 'Generation unsuccessful. Your previous grid has been kept.';
  };
  try {
    worker = new Worker(new URL('./engine/generation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ values?: number[]; cages?: Cage[]; error?: string }>) => {
      const { values, cages, error } = event.data;
      if (error || !values || !cages) { fail(error ?? 'Unable to generate a grid. Try again.'); return; }
      renderBoard(values, cages);
      generation++;
      document.querySelector('#badge')!.textContent = `${cages.length} CAGES`;
      status.textContent = `Grid ${generation} · ${cages.length} ${selectedOptions.symmetric ? 'rotationally symmetric' : 'connected'} cages · all 81 cells covered.`;
      cleanup();
    };
    worker.onerror = () => fail('Unable to generate a grid. Please reload and try again.');
    worker.postMessage(selectedOptions);
  } catch { fail('Unable to start generation. Please reload and try again.'); }
});
