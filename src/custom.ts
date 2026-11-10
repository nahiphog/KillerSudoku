import './style.css';
import './cages.css';
import './custom.css';
import { header, footer, setupAbout } from './shell';
import { customLayoutError } from './engine/customBuilder';
import type { VerifiedPuzzle } from './engine/verifiedGenerator';
import { moveSelection } from './engine/manualPlay';

document.querySelector('#app')!.innerHTML = `${header}
<main><section class="intro"><p class="eyebrow">YOUR SHAPES, A NEW CHALLENGE</p><h1>Custom Build</h1><p class="toolkit-intro">Start with an empty grid. Select cells that share edges and add them as a cage. We’ll search for cage sums that give your exact layout a unique solution.</p></section>
<div class="workspace"><section class="board-panel"><div class="panel-heading"><h2>Your cage layout</h2><span class="badge" id="coverage"></span></div>
<table class="board custom-board" role="grid" aria-label="Custom cage layout" aria-describedby="build-help"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td role="gridcell" tabindex="${r + c === 0 ? 0 : -1}" data-cell="${r * 9 + c}"></td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="board-footer"><p id="selection-status" role="status"></p></div></section>
<aside><section class="generate-panel"><h2>Define your cages</h2><p id="build-help">Click or tap cells to select them; click again to deselect. Use arrow keys to move and Space to select. Each cage holds 1–9 connected cells with no repeated digits. Select an existing cage to edit it.</p>
<div class="build-actions"><button id="save-cage">Add cage</button><button id="clear-selection">Clear selection</button><button id="delete-cage" hidden>Delete cage</button></div>
<p id="layout-error" class="error" role="alert"></p><p id="cage-count"></p><p>Unassigned cells follow ordinary Sudoku rules. Sums are generated automatically. Some layouts may not yield a unique puzzle.</p>
<button id="build">Generate unique puzzle</button><button id="cancel" hidden>Cancel search</button><button id="clear-layout">Clear all cages</button>
<p id="build-status" role="status" aria-live="polite">Add your first cage to begin.</p>
<button id="play" hidden>View generated grid →</button></section>
<section class="rules"><h2>Your cages</h2><p>Choose a cage to edit its cells. Editing the layout clears the generated result.</p><div id="cage-list"></div></section></aside></div></main>${footer}`;
setupAbout();
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>('#' + id)!;
const cells = [...document.querySelectorAll<HTMLTableCellElement>('.custom-board td')];
let groups: number[][] = [];
let selected = new Set<number>();
let editing = -1;
let focused = 0;
let worker: Worker | null = null;
let puzzle: VerifiedPuzzle | null = null;
const status = element('build-status');

function invalidate() { puzzle = null; element('play').hidden = true; status.textContent = 'Layout changed. Generate to search for matching sums.'; }
function render() {
  const owners = new Map(groups.flatMap((group, index) => group.map(cell => [cell, index] as const)));
  cells.forEach((cell, i) => {
    const owner = owners.get(i);
    cell.replaceChildren();
    cell.tabIndex = i === focused ? 0 : -1;
    cell.classList.toggle('build-selected', selected.has(i));
    cell.setAttribute('aria-selected', String(selected.has(i)));
    cell.setAttribute('aria-disabled', String(!!worker));
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${owner === undefined ? 'unassigned' : 'cage ' + (owner + 1)}${selected.has(i) ? ', selected' : ''}`);
    cell.style.backgroundColor = selected.has(i) ? '' : owner === undefined ? '' : `hsl(${(owner * 67 + 80) % 360} 35% 92%)`;
    if (owner === undefined) return;
    const outline = document.createElement('span'); outline.className = 'cage-outline';
    const edges = { top: i < 9 || owners.get(i - 9) !== owner, bottom: i >= 72 || owners.get(i + 9) !== owner, left: i % 9 === 0 || owners.get(i - 1) !== owner, right: i % 9 === 8 || owners.get(i + 1) !== owner };
    for (const [edge, boundary] of Object.entries(edges)) {
      outline.style.setProperty(edge, boundary ? '4px' : '-1px');
      if (boundary) outline.classList.add(`cage-${edge}`);
    }
    cell.append(outline);
    if (i === Math.min(...groups[owner])) {
      const label = document.createElement('span'); label.className = 'cage-sum';
      label.textContent = puzzle ? String(puzzle.cages[owner].sum) : `C${owner + 1}`; cell.append(label);
    }
  });
  element('coverage').textContent = `${owners.size}/81 CELLS IN CAGES`;
  element('cage-count').textContent = `${groups.length} cages · ${81 - owners.size} unassigned cells`;
  element('selection-status').textContent = `${selected.size} cells selected${editing >= 0 ? ` · editing cage ${editing + 1}` : ''}`;
  const error = selected.size ? customLayoutError([...groups.filter((_, i) => i !== editing), [...selected]]) : null;
  element('layout-error').textContent = error ?? '';
  element<HTMLButtonElement>('save-cage').disabled = !!worker || !selected.size || !!error;
  element('save-cage').textContent = editing >= 0 ? 'Save cage' : 'Add cage';
  element('delete-cage').hidden = editing < 0;
  element<HTMLButtonElement>('build').disabled = !!worker || !groups.length || selected.size > 0;
  for (const id of ['clear-selection', 'clear-layout', 'delete-cage']) element<HTMLButtonElement>(id).disabled = !!worker;
  element('cancel').hidden = !worker;
  const list = element('cage-list'); list.replaceChildren();
  groups.forEach((group, i) => {
    const button = document.createElement('button'); button.textContent = `Cage ${i + 1} · ${group.length} cells${puzzle ? ' · sum ' + puzzle.cages[i].sum : ''}`;
    button.disabled = !!worker; button.addEventListener('click', () => { editing = i; selected = new Set(group); render(); }); list.append(button);
  });
}
function select(index: number) {
  if (worker) return;
  focused = index;
  const owner = groups.findIndex(group => group.includes(index));
  if (owner >= 0 && owner !== editing) {
    if (selected.size) { element('layout-error').textContent = 'Save or clear your selection before editing another cage.'; return; }
    editing = owner; selected = new Set(groups[owner]);
  } else if (selected.has(index)) selected.delete(index);
  else selected.add(index);
  render();
}
cells.forEach((cell, i) => {
  cell.addEventListener('click', () => select(i));
  cell.addEventListener('keydown', event => {
    if (event.key.startsWith('Arrow')) { event.preventDefault(); focused = moveSelection(i, event.key); render(); cells[focused].focus(); }
    else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); select(i); }
  });
});
element('save-cage').addEventListener('click', () => {
  const next = [...selected].sort((a, b) => a - b);
  if (editing >= 0) groups[editing] = next; else groups.push(next);
  selected.clear(); editing = -1; invalidate(); render();
});
element('clear-selection').addEventListener('click', () => { selected.clear(); editing = -1; render(); });
element('delete-cage').addEventListener('click', () => { groups.splice(editing, 1); selected.clear(); editing = -1; invalidate(); render(); });
element('clear-layout').addEventListener('click', () => { groups = []; selected.clear(); editing = -1; invalidate(); render(); });
function stop() { worker?.terminate(); worker = null; render(); }
element('cancel').addEventListener('click', () => { stop(); status.textContent = 'Search cancelled. Your layout is unchanged.'; });
element('build').addEventListener('click', () => {
  status.textContent = 'Searching for sums and checking uniqueness…';
  try {
    worker = new Worker(new URL('./engine/custom.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ progress?: number; puzzle?: VerifiedPuzzle; error?: string }>) => {
      if (event.data.progress !== undefined) { status.textContent = `Checking candidate ${event.data.progress} for a unique solution…`; return; }
      if (event.data.puzzle) {
        puzzle = event.data.puzzle; element('play').hidden = false;
        status.textContent = `Unique solution verified in ${(puzzle.elapsedMilliseconds / 1000).toFixed(1)} seconds. Your cage sums are shown on the grid. Ready to view.`;
      } else status.textContent = event.data.error ?? 'Unable to generate a puzzle. Try again.';
      stop();
    };
    worker.onerror = () => { stop(); status.textContent = 'Search failed. Your layout is unchanged. Please try again.'; };
    worker.postMessage(groups); render();
  } catch { stop(); status.textContent = 'Unable to start the search. Please reload and try again.'; }
});
element('play').addEventListener('click', () => {
  if (!puzzle) return;
  try { sessionStorage.setItem('custom-puzzle', JSON.stringify(puzzle)); location.href = './?custom=1'; }
  catch { status.textContent = 'Browser storage is unavailable. Enable session storage to view this puzzle.'; }
});
render();
