import './style.css';
import './cages.css';
import { generateFullGrid } from './engine/generator';
import { TECHNIQUES } from './engine/solver';
import { generateCages, type Cage } from './engine/cages';
import type { Grid } from './vendor/sudokui/board';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header"><a class="brand" href="./"><span class="brand-icon" aria-hidden="true">▦</span> Killer Sudoku</a><span class="header-note">MAKER & SOLVER</span></header>
  <main>
    <section class="intro"><p class="eyebrow">A LITTLE STRUCTURE. ENDLESS POSSIBILITIES.</p><h1>Every puzzle starts<br>with a full grid.</h1><p class="lede">Generate a completed Sudoku grid.<br>The starting point for your next Killer Sudoku.</p></section>
    <div class="workspace">
      <section class="board-panel" aria-labelledby="board-title">
        <div class="panel-heading"><h2 id="board-title">Your grid</h2><span class="badge" id="badge">READY TO GENERATE</span></div>
        <table class="board" aria-label="Sudoku grid"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td aria-label="Row ${r + 1}, column ${c + 1}, empty"></td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="board-footer"><span class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite">A blank canvas. Generate your first grid.</p></div>
      </section>
      <aside>
        <section class="generate-panel"><span class="step-label">01 / THE FOUNDATION</span><h2>Make a fresh start.</h2><p>One click fills all 81 cells with a valid solution. Every row, column and 3 × 3 box contains the digits 1–9.</p><button id="generate" type="button"><span aria-hidden="true">↻</span> Generate <span class="button-arrow" aria-hidden="true">↗</span></button><p class="hint">A new completed grid with every click.</p></section>
        <section class="cage-panel"><span class="step-label">02 / THE CAGES</span><h2>Give it some shape.</h2><p>Divide your grid into connected cages of at least two cells, with no repeated digits.</p><button id="generate-cages" type="button" disabled>Generate cages <span class="button-arrow" aria-hidden="true">↗</span></button><p class="hint" id="cage-hint">Generate a completed grid first.</p></section>
        <section class="rules"><p class="eyebrow">THE KILLER TWIST</p><h2>Simple rules.<br>Interesting possibilities.</h2><p>Normal sudoku rules apply. Additionally, the sum of the numbers in each outlined region is equal to the corresponding number given in a corner of the outline. No digit is repeated within a given outlined region.</p><div class="scope-note">Each dashed outline is a cage. Its top-left corner shows the sum of its digits.</div></section>
      </aside>
    </div>
    <details class="techniques"><summary><span>Solving toolkit <span class="count">20 techniques</span></span><span class="expand" aria-hidden="true">+</span></summary><p>The standard Sudoku techniques are imported and available in the engine for the next stage of the solver.</p><ul>${TECHNIQUES.map(t => `<li>${t.name}</li>`).join('')}</ul></details>
  </main>
  <footer><span>Built one possibility at a time.</span><span>Solving engine adapted from <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">sudokUI</a> · GPL-3.0</span></footer>`;

const button = document.querySelector<HTMLButtonElement>('#generate')!;
const cells = [...document.querySelectorAll<HTMLTableCellElement>('.board td')];
const cageButton = document.querySelector<HTMLButtonElement>('#generate-cages')!;
let grid: Grid | null = null;
let generation = 0;
function renderBoard(cages: Cage[] = []) {
  const cageForCell = new Map(cages.flatMap(cage => cage.cells.map(cell => [cell, cage] as const)));
  cells.forEach((cell, i) => {
    const cage = cageForCell.get(i);
    cell.replaceChildren();
    const digit = document.createElement('span');
    digit.className = 'cell-digit';
    digit.textContent = String(grid!.values[i]);
    cell.append(digit);
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${grid!.values[i]}${cage ? `, cage sum ${cage.sum}, ${cage.cells.length} cells` : ''}`);
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
  document.querySelector('.board')!.classList.toggle('has-cages', cages.length > 0);
}
button.addEventListener('click', () => {
  grid = generateFullGrid();
  generation++;
  renderBoard();
  cageButton.disabled = false;
  document.querySelector('#cage-hint')!.textContent = 'Create cages, or click again for a fresh layout.';
  document.querySelector('#badge')!.textContent = 'COMPLETE GRID';
  document.querySelector('#status')!.textContent = `Grid ${generation} generated. All 27 rows, columns and boxes valid.`;
});
cageButton.addEventListener('click', () => {
  if (!grid) return;
  const cages = generateCages(grid.values);
  renderBoard(cages);
  document.querySelector('#badge')!.textContent = `${cages.length} CAGES`;
  document.querySelector('#status')!.textContent = `${cages.length} cages generated. All 81 cells covered; at least 2 distinct digits per cage.`;
});
