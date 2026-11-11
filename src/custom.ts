import { combinationTable } from './engine/combinations';
import type { CageOperation } from './engine/cages';
import { parseGridString } from './engine/gridImport';
import { exportControls, setupGridExport, visibleGrid, serializeGrid } from './gridExport';
import { customEntryGrid } from './engine/customEntries';
import { digitsOf } from './vendor/sudokui/board';
import { generationTimer } from './generationTimer';
import './style.css';
import './cages.css';
import './custom.css';
import { header, footer, setupAbout } from './shell';
import { customLayoutError } from './engine/customBuilder';
import type { VerifiedPuzzle } from './engine/verifiedGenerator';
import { newManualBoard, enterManualDigit, eraseManualCell, moveSelection } from './engine/manualPlay';

document.querySelector('#app')!.innerHTML = `${header}
<main><section class="intro"><p class="eyebrow">YOUR SHAPES, A NEW CHALLENGE</p><h1>Custom Build</h1><p class="toolkit-intro">Design or edit cages, sums, digits and Snyder notations. Generate sums for a new layout, or verify your own clues to prepare a solution walkthrough.</p></section>
<div class="workspace"><section class="board-panel"><div class="panel-heading"><h2>Your cage layout</h2><span class="badge" id="coverage"></span></div>
<table class="board custom-board" role="grid" aria-label="Custom cage layout" aria-describedby="build-help"><tbody>${Array.from({ length: 9 }, (_, r) => `<tr>${Array.from({ length: 9 }, (_, c) => `<td role="gridcell" tabindex="${r + c === 0 ? 0 : -1}" data-cell="${r * 9 + c}"></td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="board-footer"><p id="selection-status" role="status"></p></div>${exportControls}</section>
<aside><section class="entry-panel"><h2>Cell entries</h2><div class="entry-modes" aria-label="Build mode"><button type="button" data-mode="cages" aria-pressed="true">Cages</button><button type="button" data-mode="digits" aria-pressed="false">Digits</button><button type="button" data-mode="notes" aria-pressed="false">Snyder notations</button><button type="button" data-mode="cage-free" aria-pressed="false">Cage-free cells</button></div><p>Choose Digits or Snyder notations, then select a cell and enter 1–9. P toggles notations. Delete or Backspace erases. Notations list every allowed digit; an empty cell is unrestricted.</p><p>Choose Cage-free cells and click cells (or press Space) to toggle × tags. Tagged cells stay outside every cage; digits and notations are still allowed. Remove an existing cage before tagging its cells.</p><div class="custom-number-pad"><button type="button" data-digit="1">1</button><button type="button" data-digit="2">2</button><button type="button" data-digit="3">3</button><button type="button" data-digit="4">4</button><button type="button" data-digit="5">5</button><button type="button" data-digit="6">6</button><button type="button" data-digit="7">7</button><button type="button" data-digit="8">8</button><button type="button" data-digit="9">9</button><button type="button" id="erase-cell">Erase</button></div><p id="entry-status" role="status"></p><p id="entry-error" class="error" role="alert"></p></section><section class="generate-panel"><h2>Define your cages</h2><p id="build-help">Click or tap cells to select them; click again to deselect. Use arrow keys to move and Space to select. Each cage holds 1–9 connected cells with no repeated digits. Select an existing cage to edit it.</p>
<label for="custom-operation">Cage arithmetic</label><select id="custom-operation"><option value="sum">Sum</option><option value="product">Product</option></select><label for="cage-sum-input">Cage target</label><input id="cage-sum-input" type="number" min="1" max="362880" step="1" placeholder="Automatic for new layouts"><p id="sum-help">Select a cage to edit its cells, arithmetic and target. Leave sums blank only when generating a new layout automatically.</p><div class="build-actions"><button id="save-cage">Add cage</button><button id="clear-selection">Clear selection</button><button id="delete-cage" hidden>Delete cage</button></div>
<p id="layout-error" class="error" role="alert"></p><p id="cage-count"></p><p>Unassigned cells follow ordinary Sudoku rules. For new layouts, blank sums can be generated automatically. Imported or entered sums stay fixed. Supply a sum for every cage before verifying edited clues. Some layouts may not yield a unique puzzle.</p>
<button id="build">Generate unique puzzle</button><button id="clear-layout">Clear all cages</button>
<p id="build-live" role="timer" hidden></p><p id="build-status" role="status" aria-live="polite">Add your first cage to begin.</p>
<button id="play" hidden>Open solution walkthrough →</button></section>
<section class="rules"><h2>Your cages</h2><p>Choose a cage to edit its cells. Editing the layout clears the generated result.</p><div id="cage-list"></div></section></aside></div></main>${footer}`;
setupAbout();
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>('#' + id)!;
const cells = [...document.querySelectorAll<HTMLTableCellElement>('.custom-board td')];
let groups: number[][] = [];
let sums: (number | null)[] = [];
let operations: CageOperation[] = [];
let fixedSums = false;
let entries = newManualBoard();
const cageFreeCells = new Set<number>();
let mode: 'cages' | 'digits' | 'notes' | 'cage-free' = 'cages';
let selected = new Set<number>();
let editing = -1;
let focused = 0;
let worker: Worker | null = null;
let puzzle: VerifiedPuzzle | null = null;
const status = element('build-status');
const liveTimer = generationTimer(element('build-live'));

const updateExportControls = setupGridExport(document.querySelector<HTMLElement>('.custom-board')!, () => visibleGrid(document.querySelector<HTMLElement>('.custom-board')!, puzzle?.cages ?? groups.map((cells,i)=>({cells,sum:sums[i] ?? null,operation:operations[i]})), [...cageFreeCells]));
function invalidate() { puzzle = null; element('play').hidden = true; status.textContent = 'Entries or layout changed. Verify or generate again to refresh the walkthrough.'; }
function render() {
  updateExportControls(!worker);
  element('play').hidden = !puzzle || selected.size > 0 || !!worker;
  const owners = new Map(groups.flatMap((group, index) => group.map(cell => [cell, index] as const)));
  cells.forEach((cell, i) => {
    const owner = owners.get(i);
    cell.replaceChildren();
    cell.classList.toggle('cage-free', cageFreeCells.has(i));
    if(cageFreeCells.has(i)) {const tag=document.createElement('span');tag.className='cage-free-tag';tag.textContent='×';tag.setAttribute('aria-hidden','true');cell.append(tag);}
    cell.tabIndex = i === focused ? 0 : -1;
    cell.classList.toggle('build-selected', selected.has(i));
    cell.setAttribute('aria-selected', String(selected.has(i)));
    cell.setAttribute('aria-disabled', String(!!worker));
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${owner === undefined ? 'unassigned' : 'cage ' + (owner + 1)}${selected.has(i) ? ', selected' : ''}${cageFreeCells.has(i) ? ', tagged cage-free' : ''}`);
    cell.classList.toggle('entry-focused', mode !== 'cages' && focused === i);
    cell.style.backgroundColor = '';
    if (entries.values[i]) {
      const digit = document.createElement('span'); digit.className = 'custom-digit'; digit.textContent = String(entries.values[i]); cell.append(digit);
    } else if (entries.notes[i]) {
      const notes = document.createElement('span'); notes.className = 'custom-notes';
      for(let d=1;d<=9;d++) {const mark=document.createElement('span');mark.textContent=entries.notes[i] & (1 << (d-1)) ? String(d) : '';notes.append(mark);}
      cell.append(notes);
    }
    cell.setAttribute('aria-label', cell.getAttribute('aria-label') + (entries.values[i] ? ', digit ' + entries.values[i] : entries.notes[i] ? ', Snyder notations ' + digitsOf(entries.notes[i]).join(', ') : ', empty'));
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
      label.textContent = puzzle ? String(puzzle.cages[owner].sum) : sums[owner] != null ? String(sums[owner]) : `C${owner + 1}`;
      label.textContent += operations[owner] === 'product' ? '×' : '+';
      if (operations[owner] === 'product' && (sums[owner] ?? 0) >= 10000) label.style.fontSize = '10px';
      cell.append(label);
    }
  });
  element('coverage').textContent = `${owners.size}/81 CELLS IN CAGES`;
  element('cage-count').textContent = `${groups.length} cages · ${81 - owners.size} unassigned cells · ${cageFreeCells.size} tagged cage-free`;
  element('selection-status').textContent = `${selected.size} cells selected${editing >= 0 ? ` · editing cage ${editing + 1}` : ''}`;
  const error = selected.size ? customLayoutError([...groups.filter((_, i) => i !== editing), [...selected]], [...cageFreeCells]) ?? sumError() : null;
  element<HTMLInputElement>('cage-sum-input').disabled = !!worker || !selected.size;
  element<HTMLSelectElement>('custom-operation').disabled = !!worker;
  element('layout-error').textContent = error ?? '';
  element<HTMLButtonElement>('save-cage').disabled = !!worker || !selected.size || !!error;
  element('save-cage').textContent = editing >= 0 ? 'Save cage' : 'Add cage';
  element('delete-cage').hidden = editing < 0;
  let entryError = '';
  try { customEntryGrid(entries, groups); } catch (error) { entryError = (error as Error).message; }
  element('entry-error').textContent = entryError;
  element('entry-status').textContent = 'r' + (Math.floor(focused/9)+1) + 'c' + (focused%9+1) + ' · ' + (mode === 'notes' ? 'Snyder notations' : mode === 'digits' ? 'digit entry' : mode === 'cage-free' ? 'toggle cage-free tags' : 'cage selection');
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {button.disabled=!!worker;button.setAttribute('aria-pressed', String(button.dataset.mode === mode));}
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-digit],#erase-cell')) button.disabled=!!worker || mode === 'cages' || mode === 'cage-free';
  element<HTMLButtonElement>('build').disabled = !worker && ((!groups.length && !entries.values.some(Boolean) && !entries.notes.some(Boolean)) || selected.size > 0 || !!entryError || (fixedSums && sums.some(sum=>sum===null)));
  element('sum-help').textContent = fixedSums ? 'Select a cage, edit its cells, arithmetic and target, then Save cage. Every cage needs a target before verification.' : 'Select a cage to edit its cells, arithmetic and target. Leave all sums blank for automatic generation.';
  element('build').textContent = worker ? 'Cancel search' : fixedSums ? 'Verify and prepare walkthrough' : 'Generate unique puzzle';
  for (const id of ['clear-selection', 'clear-layout', 'delete-cage']) element<HTMLButtonElement>(id).disabled = !!worker;
  const list = element('cage-list'); list.replaceChildren();
  groups.forEach((group, i) => {
    const button = document.createElement('button'); button.textContent = `Cage ${i + 1} · ${group.length} cells${puzzle ? ' · ' + (operations[i] ?? 'sum') + ' ' + puzzle.cages[i].sum : sums[i] != null ? ' · ' + (operations[i] ?? 'sum') + ' ' + sums[i] : ' · target needed'}`;
    button.disabled = !!worker; button.addEventListener('click', () => { mode = 'cages'; editing = i; selected = new Set(group); element<HTMLInputElement>('cage-sum-input').value=String(sums[i] ?? ''); element<HTMLSelectElement>('custom-operation').value=operations[i] ?? 'sum'; render(); }); list.append(button);
  });
}
function select(index: number) {
  if (worker) return;
  focused = index;
  if(mode === 'cage-free') {
    if(groups.some(group => group.includes(index))) {element('entry-error').textContent='Remove this cell’s cage before tagging it cage-free.';return;}
    if(cageFreeCells.has(index)) cageFreeCells.delete(index); else cageFreeCells.add(index);
    invalidate();render();return;
  }
  if (mode !== 'cages') { render(); return; }
  if(cageFreeCells.has(index)) {element('layout-error').textContent='This cell is tagged cage-free. Untag it before adding a cage.';return;}
  const owner = groups.findIndex(group => group.includes(index));
  if (owner >= 0 && owner !== editing) {
    if (selected.size) { element('layout-error').textContent = 'Save or clear your selection before editing another cage.'; return; }
    editing = owner; selected = new Set(groups[owner]); element<HTMLInputElement>('cage-sum-input').value=String(sums[owner] ?? ''); element<HTMLSelectElement>('custom-operation').value=operations[owner] ?? 'sum';
  } else if (selected.has(index)) selected.delete(index);
  else selected.add(index);
  render();
}
cells.forEach((cell, i) => {
  cell.addEventListener('click', () => { select(i); cell.focus({preventScroll:true}); });
  cell.addEventListener('focus', () => { if(focused !== i && !worker) {focused=i;render();} });
  cell.addEventListener('keydown', event => {
    if (worker || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); if(mode === 'cages' || mode === 'cage-free') setMode('digits'); enterDigit(Number(event.key)); }
    else if(event.key.toLowerCase() === 'p') {event.preventDefault();setMode(mode === 'notes' ? 'digits' : 'notes');}
    else if(['Backspace','Delete','0'].includes(event.key)) {event.preventDefault();eraseEntry();}
    else if (event.key.startsWith('Arrow')) { event.preventDefault(); focused = moveSelection(i, event.key); render(); cells[focused].focus(); }
    else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); select(i); }
  });
});
function setMode(next: typeof mode) {if(worker) return; mode=next;selected.clear();editing=-1;element<HTMLInputElement>('cage-sum-input').value='';render();}
function enterDigit(digit: number) {
  if(worker || mode === 'cages' || mode === 'cage-free') return;
  if(mode === 'notes' && entries.values[focused]) entries=eraseManualCell(entries,focused);
  entries=enterManualDigit(entries,focused,digit,mode === 'notes');invalidate();render();
}
function eraseEntry() {if(worker) return;entries=eraseManualCell(entries,focused);invalidate();render();}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) button.addEventListener('click',()=>setMode(button.dataset.mode as typeof mode));
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-digit]')) button.addEventListener('click',()=>enterDigit(Number(button.dataset.digit)));
element('erase-cell').addEventListener('click',eraseEntry);
function sumError(): string | null {
  const raw=element<HTMLInputElement>('cage-sum-input').value;
  if(!raw) return fixedSums ? 'Enter a target for this cage.' : null;
  const sum=Number(raw), n=selected.size;
  const op=element<HTMLSelectElement>('custom-operation').value as CageOperation;
  return !Number.isInteger(sum) || n<1 || n>9 || !(n===1 ? sum>=1 && sum<=9 : combinationTable(n,op).some(row=>row.sum===sum)) ? 'Enter a valid target for this cage’s operation and distinct digits.' : null;
}
element('cage-sum-input').addEventListener('input',render);
element('custom-operation').addEventListener('change',render);
element('save-cage').addEventListener('click', () => {
  const next = [...selected].sort((a, b) => a - b);
  if(worker || sumError() || customLayoutError([...groups.filter((_,i)=>i!==editing),next],[...cageFreeCells])) return;
  const raw=element<HTMLInputElement>('cage-sum-input').value;
  const sum=raw ? Number(raw) : null;
  if(sum!==null) fixedSums=true;
  if (editing >= 0) {groups[editing] = next;sums[editing]=sum;operations[editing]=element<HTMLSelectElement>('custom-operation').value as CageOperation;} else {groups.push(next);sums.push(sum);operations.push(element<HTMLSelectElement>('custom-operation').value as CageOperation);}
  element<HTMLInputElement>('cage-sum-input').value='';
  selected.clear(); editing = -1; invalidate(); render();
});
element('clear-selection').addEventListener('click', () => { selected.clear(); editing = -1; element<HTMLInputElement>('cage-sum-input').value=''; render(); });
element('delete-cage').addEventListener('click', () => { groups.splice(editing, 1); sums.splice(editing,1);operations.splice(editing,1); element<HTMLInputElement>('cage-sum-input').value=''; selected.clear(); editing = -1; invalidate(); render(); });
element('clear-layout').addEventListener('click', () => { groups = []; sums = []; operations = []; element<HTMLInputElement>('cage-sum-input').value=''; selected.clear(); editing = -1; invalidate(); render(); });
function stop() { liveTimer.stop(); worker?.terminate(); worker = null; render(); }
element('build').addEventListener('click', () => {
  if(worker) {stop();status.textContent='Search cancelled. Your layout is unchanged.';return;}
  liveTimer.start(!fixedSums);
  status.textContent = fixedSums ? 'Verifying your edited cage sums and preparing the walkthrough…' : 'Searching for sums and checking uniqueness…';
  try {
    worker = fixedSums ? new Worker(new URL('./engine/import.worker.ts', import.meta.url), {type:'module'}) : new Worker(new URL('./engine/custom.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ progress?: number; puzzle?: VerifiedPuzzle; error?: string }>) => {
      if (event.data.progress !== undefined) { liveTimer.setAttempts(event.data.progress); status.textContent = `Checking candidate ${event.data.progress} for a unique solution…`; return; }
      if (event.data.puzzle) {
        puzzle = event.data.puzzle; sums=puzzle.cages.map(cage=>cage.sum);operations=puzzle.cages.map(cage=>cage.operation ?? 'sum'); fixedSums=true; element('play').hidden = false;
        status.textContent = `Unique solution verified in ${(puzzle.elapsedMilliseconds / 1000).toFixed(1)} seconds. Your cage clues are shown on the grid. Ready to view.`;
      } else status.textContent = event.data.error ?? 'Unable to generate a puzzle. Try again.';
      stop();
    };
    worker.onerror = () => { stop(); status.textContent = 'Search failed. Your layout is unchanged. Please try again.'; };
    worker.postMessage(fixedSums ? serializeGrid({cages:groups.map((cells,i)=>({cells,sum:sums[i],operation:operations[i]})),values:entries.values,notes:entries.notes.map(digitsOf),cageFreeCells:[...cageFreeCells]}) : {groups,entries,cageFreeCells:[...cageFreeCells],operations}); render();
  } catch { stop(); status.textContent = 'Unable to start the search. Please reload and try again.'; }
});
element('play').addEventListener('click', () => {
  if (!puzzle) return;
  try { sessionStorage.setItem('custom-puzzle', JSON.stringify(puzzle)); location.href = './?custom=1'; }
  catch { status.textContent = 'Browser storage is unavailable. Enable session storage to view this puzzle.'; }
});
render();

if(new URLSearchParams(location.search).get('edit')==='1') {
  try {
    const saved=sessionStorage.getItem('edit-grid');
    if(!saved) throw new Error('No grid is available to edit. Import a grid and choose Edit in Custom Build.');
    const restored=parseGridString(saved);
    groups=restored.cages.map(cage=>[...cage.cells]);sums=restored.cages.map(cage=>cage.sum);operations=restored.cages.map(cage=>cage.operation ?? 'sum');entries=restored.entries;
    restored.cageFreeCells.forEach(cell=>cageFreeCells.add(cell));fixedSums=true;render();
    status.textContent='Imported grid restored. Edit cages, sums, digits or Snyder notations, then verify to prepare a new walkthrough.';
  } catch(error) {status.textContent=(error as Error).message;}
}
