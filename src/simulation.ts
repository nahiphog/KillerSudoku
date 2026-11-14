import './style.css';
import { cageLegend } from './cageLegend';
import './cages.css';
import './simulation.css';
import { header, footer, setupAbout } from './shell';
import { HISTOGRAM_EDGES, TRIAL_COUNTS, RATING_THRESHOLDS, histogramBin, matchesSimulation, type SimulationResult, type SimulationRecord } from './engine/simulation';
import { simulationStore } from './simulationStore';
import { exportControls, setupGridExport, gridImage } from './gridExport';
import { simulationExportGrid } from './simulationExport';
import { simulationWalkthroughUrl } from './simulationWalkthrough';
import { cageOptionsError, DEFAULT_CAGE_SIZES, type CageArithmetic, cageSymbol } from './engine/cages';
import { retainedCageSizesError, type PuzzleOptions } from './engine/verifiedGenerator';

document.querySelector('#app')!.innerHTML = `${header}<main class="simulation-page">
  <h1>Simulation</h1><p>Generate unique puzzles using the cage settings below. One trial is one generation search; unsuccessful searches are counted separately.</p>
  <fieldset id="simulation-inputs"><label>Total trials <select id="trials">${TRIAL_COUNTS.map(n=>`<option value="${n}" ${n===1000000?'selected':''}>${n.toLocaleString()}</option>`).join('')}</select></label>
  <label>Display grids with difficulty ratings of at least <select id="minimum">${RATING_THRESHOLDS.map(n=>`<option value="${n}">${n.toLocaleString()}</option>`).join('')}</select></label>
  <label class="symmetry-option"><input type="checkbox" id="no-brute-force" checked> Display only grids that do not use brute force</label>
  <fieldset id="simulation-generation"><legend>Generation settings</legend>
    <label>Cage arithmetic <select id="cage-operation"><option value="sum">Sum</option><option value="product">Product</option><option value="mixed">Sum + Product</option><option value="psycho">Psycho</option></select></label>
    <fieldset id="simulation-cage-sizes"><legend>Allowed cells per cage</legend>${Array.from({length:9},(_,i)=>i+1).map(size=>`<label>${size} ${size===1?'cell':'cells'} <select name="cage-size" data-size="${size}" aria-label="${size}-cell cages"><option value="none">None</option><option value="required" ${DEFAULT_CAGE_SIZES.includes(size)?'selected':''}>At least 1</option></select></label>`).join('')}</fieldset>
    <label class="symmetry-option"><input type="checkbox" id="symmetry" checked> Rotationally symmetric cages</label>
    <label class="symmetry-option"><input type="checkbox" id="dig-cages" checked> Dig cages after generation</label>
    <label class="symmetry-option"><input type="checkbox" id="dig-pairs" checked> Dig cages in pairs</label>
    <label class="symmetry-option"><input type="checkbox" id="dig-singletons"> Dig out all 1-cell cages</label>
    <label class="symmetry-option"><input type="checkbox" id="logic-only" checked> Require a complete logical solve</label>
    <p>None excludes a cage size. At least 1 retains that size, except when removing all 1-cell cages. Require a complete logical solve controls generation; the no-brute-force display filter only controls which grids are shown.</p>
  </fieldset></fieldset>
  <p id="simulation-error" class="error" role="alert" hidden></p>
  <button id="run-simulation">Start simulation</button><p id="simulation-status" role="status">Ready.</p><p id="simulation-progress" role="timer"></p>
  <section class="histogram-panel" aria-labelledby="histogram-title"><h2 id="histogram-title">Difficulty ratings</h2><p>All successfully generated puzzles, including grids excluded by the display filters. Each bar counts puzzles within its labelled rating range.</p><div id="histogram"></div></section>
  <section aria-labelledby="results-title"><h2 id="results-title">Matching grids</h2><p id="match-count">0 matching grids</p>
  <div class="simulation-paging"><button id="newer" disabled>Newer</button><button id="older" disabled>Older</button><button id="latest" disabled>Follow latest</button><span id="page-count"></span></div>
  <div id="simulation-grids"></div></section></main>${footer}`;
setupAbout();
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let worker: Worker | null = null;
let store: Awaited<ReturnType<typeof simulationStore>> | undefined;
let running = false, runId = 0, renderId = 0, completed = 0, succeeded = 0, failed = 0, matched = 0, attempts = 0, target = 0;
let pageOffset = 0, followLatest = true, started = 0;
let minimum = 0, noBruteForce = true;
let timer: ReturnType<typeof setInterval> | undefined;
let bins = Array<number>(HISTOGRAM_EDGES.length - 1).fill(0);
const PAGE_SIZE = 6;
function generationOptions(): PuzzleOptions {
  const sizes=[...document.querySelectorAll<HTMLSelectElement>('#simulation-cage-sizes select')].filter(select=>select.value==='required').map(select=>Number(select.dataset.size));
  return {sizes,retainedCageSizes:sizes,operation:el<HTMLSelectElement>('cage-operation').value as CageArithmetic,
    symmetric:el<HTMLInputElement>('symmetry').checked,dig:el<HTMLInputElement>('dig-cages').checked,
    digPairs:el<HTMLInputElement>('dig-pairs').checked,digSingletons:el<HTMLInputElement>('dig-singletons').checked,
    logicOnly:el<HTMLInputElement>('logic-only').checked};
}
function validateGeneration() {
  const options=generationOptions();
  const error=cageOptionsError(options) ?? retainedCageSizesError(options) ?? (options.sizes?.every(size=>size===9) ? 'Nine-cell cages all contain digits 1–9 and cannot give a unique puzzle. Allow smaller cage sizes.' : null);
  el('simulation-error').textContent=error ?? '';el('simulation-error').hidden=!error;
  el<HTMLButtonElement>('run-simulation').disabled=!!error&&!running;
  el<HTMLInputElement>('dig-pairs').disabled=!options.dig||!options.symmetric;
  el<HTMLInputElement>('dig-singletons').disabled=!options.dig||!options.sizes?.includes(1);
  return !error;
}
el('simulation-inputs').addEventListener('change',validateGeneration);
function progress() {
  el('simulation-progress').textContent = `${completed.toLocaleString()} / ${target.toLocaleString()} trials · ${succeeded.toLocaleString()} generated · ${failed.toLocaleString()} unsuccessful · Current trial attempts: ${attempts.toLocaleString()} · ${((performance.now()-started)/1000).toFixed(1)} s elapsed`;
}
function finish(message: string) {
  running = false; worker?.terminate(); worker = null;
  if(timer) clearInterval(timer); timer = undefined;
  el<HTMLFieldSetElement>('simulation-inputs').disabled = false;
  el('run-simulation').textContent = 'Start simulation';
  el('simulation-status').textContent = message;
  validateGeneration();
  progress();
}
function histogram() {
  const max = Math.max(1, ...bins), width = 1000, bottom = 220, barWidth = 56;
  const short = (n: number) => n>=1000000 ? '1M' : n>=1000 ? `${n/1000}k` : String(n);
  const ranges = bins.map((_,i) => HISTOGRAM_EDGES[i+1]===Infinity ? `${short(HISTOGRAM_EDGES[i])}+` : `${short(HISTOGRAM_EDGES[i])}–<${short(HISTOGRAM_EDGES[i+1])}`);
  el('histogram').innerHTML = `<svg viewBox="0 0 ${width} 300" role="img" aria-label="Difficulty rating histogram: ${succeeded} generated puzzles"><title>Difficulty rating distribution</title><text x="6" y="16">Puzzles (maximum ${max})</text><path d="M 38 30 V ${bottom} H 990" fill="none" stroke="#9aa99c"/>${bins.map((count,i)=>{
    const x=46+i*63, height=count/max*170;
    return `<g><title>${ranges[i]}: ${count} puzzles</title><rect x="${x}" y="${bottom-height}" width="${barWidth}" height="${height}" fill="#7739a5"/><text x="${x+barWidth/2}" y="${bottom-height-5}" text-anchor="middle">${count}</text><text transform="translate(${x+barWidth/2},235) rotate(-35)" text-anchor="end">${ranges[i]}</text></g>`;
  }).join('')}<text x="500" y="294" text-anchor="middle">Difficulty rating</text></svg>
  <details><summary>Histogram counts</summary><table><thead><tr><th>Rating range</th><th>Puzzles</th></tr></thead><tbody>${bins.map((count,i)=>`<tr><td>${ranges[i]}</td><td>${count}</td></tr>`).join('')}</tbody></table></details>`;
}
function card(record: SimulationRecord) {
  const article = document.createElement('article'); article.className = 'simulation-card';
  const displayed = new Date(record.displayedAt);
  article.innerHTML = `<h3>Trial ${record.trial.toLocaleString()}</h3><dl><div><dt>Generation time</dt><dd>${(record.elapsedMilliseconds/1000).toFixed(2)} s</dd></div><div><dt>Difficulty rating</dt><dd>${record.rating}</dd></div><div><dt>Displayed (local time)</dt><dd><time datetime="${displayed.toISOString()}">${displayed.toLocaleString()}</time></dd></div></dl>`;
  const board = document.createElement('table'); board.className = 'board has-cages'; board.setAttribute('aria-label', `Puzzle from trial ${record.trial}`);
  const owners = new Map(record.cages.flatMap(c=>c.cells.map(cell=>[cell,c] as const)));
  for(let row=0;row<9;row++) {
    const tr=board.insertRow();
    for(let col=0;col<9;col++) {
      const index=row*9+col, cell=tr.insertCell(), cage=owners.get(index);
      cell.setAttribute('aria-label',`Row ${row+1}, column ${col+1}, ${cage ? `cage ${cage.operation ?? 'sum'} ${cage.sum}, ${cage.cells.length} cells` : 'no cage'}`);
      if(!cage) continue;
      cell.dataset.cageOperation=cage.operation ?? 'sum';
      const outline=document.createElement('span'); outline.className='cage-outline'; outline.setAttribute('aria-hidden','true');
      const edges={top:row===0||owners.get(index-9)!==cage,bottom:row===8||owners.get(index+9)!==cage,left:col===0||owners.get(index-1)!==cage,right:col===8||owners.get(index+1)!==cage};
      for(const [edge,boundary] of Object.entries(edges)) {outline.style.setProperty(edge,boundary?'4px':'-1px');if(boundary)outline.classList.add('cage-'+edge);}
      cell.append(outline);
      if(index===Math.min(...cage.cells)) {const clue=document.createElement('span');clue.className='cage-sum';clue.textContent=cage.sum+cageSymbol(cage.operation);if(cage.sum>=10000)clue.style.fontSize='10px';cell.append(clue);}
    }
  }
  article.append(board);
  article.insertAdjacentHTML('beforeend',cageLegend);
  const walkthrough=document.createElement('a');walkthrough.className='simulation-walkthrough';
  walkthrough.textContent='Open solution walkthrough';walkthrough.href=simulationWalkthroughUrl(record);
  walkthrough.target='_blank';walkthrough.rel='noopener';walkthrough.setAttribute('aria-label',`Open solution walkthrough for trial ${record.trial} (new tab)`);
  article.append(walkthrough);
  // Each result owns its controls and status, with no repeated document IDs.
  article.insertAdjacentHTML('beforeend',exportControls.replace(/id="([^"]+)"/g,'data-export-control="$1"'));
  setupGridExport(board,()=>simulationExportGrid(record,false),{
    snapshot:variant=>simulationExportGrid(record,variant==='completed'),
    image:variant=>{
      const digits:HTMLElement[]=[];
      try {
        if(variant==='completed')for(const [index,cell] of [...board.querySelectorAll('td')].entries()){
          const digit=document.createElement('span');digit.className='cell-digit';digit.textContent=record.solution[index];cell.append(digit);digits.push(digit);
        }
        return gridImage(board);
      } finally {for(const digit of digits)digit.remove();}
    },
  },article)(true);
  article.querySelector('[data-export-control="copy-grid-image"]')!.remove();
  article.querySelector('[data-export-control="copy-grid-string"]')!.remove();
  return article;
}
async function results() {
  const version=++renderId, currentStore=store;
  const end=matched-pageOffset, start=Math.max(1,end-PAGE_SIZE+1);
  el('match-count').textContent=`${matched.toLocaleString()} matching grids`;
  el<HTMLButtonElement>('newer').disabled=pageOffset===0;
  el<HTMLButtonElement>('older').disabled=start<=1;
  el<HTMLButtonElement>('latest').disabled=followLatest;
  el('page-count').textContent=matched ? `Matches ${start.toLocaleString()}–${end.toLocaleString()} of ${matched.toLocaleString()}` : '';
  if(!currentStore || !matched) {el('simulation-grids').replaceChildren();return;}
  const records=await Promise.all(Array.from({length:end-start+1},(_,i)=>currentStore.get(end-i)));
  if(version!==renderId)return;
  el('simulation-grids').replaceChildren(...records.map(card));
}
function showResults() {void results().catch(()=>{finish('Stopped: unable to read locally stored results.');});}
el('newer').addEventListener('click',()=>{pageOffset=Math.max(0,pageOffset-PAGE_SIZE);followLatest=pageOffset===0;showResults();});
el('older').addEventListener('click',()=>{pageOffset+=PAGE_SIZE;followLatest=false;showResults();});
el('latest').addEventListener('click',()=>{pageOffset=0;followLatest=true;showResults();});
el('run-simulation').addEventListener('click',async()=>{
  if(running) {runId++;finish('Simulation stopped. Completed results are retained.');return;}
  if(!validateGeneration())return;
  const selectedOptions=generationOptions();
  const thisRun=++runId;
  running=true;started=performance.now();completed=succeeded=failed=matched=attempts=pageOffset=0;followLatest=true;
  target=Number(el<HTMLSelectElement>('trials').value);minimum=Number(el<HTMLSelectElement>('minimum').value);noBruteForce=el<HTMLInputElement>('no-brute-force').checked;
  bins.fill(0);histogram();store?.dispose();store=undefined;showResults();
  el<HTMLFieldSetElement>('simulation-inputs').disabled=true;el('run-simulation').textContent='Stop simulation';el('simulation-status').textContent='Starting simulation…';
  progress();timer=setInterval(progress,100);
  try {
    const opened=await simulationStore();if(thisRun!==runId){opened.dispose();return;}store=opened;
    worker=new Worker(new URL('./engine/simulation.worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=async(event:MessageEvent<{attempt?:number;result?:SimulationResult;error?:string}>)=>{
      if(thisRun!==runId)return;
      if(event.data.attempt!==undefined){attempts=event.data.attempt;progress();return;}
      completed++;
      const result=event.data.result;
      if(result){
        succeeded++;bins[histogramBin(result.rating)]++;histogram();
        if(matchesSimulation(result,minimum,noBruteForce)){
          try {
            await opened.put(matched+1,{...result,trial:completed,displayedAt:Date.now()});
            if(thisRun!==runId)return;
            matched++;if(!followLatest)pageOffset++;
            await results();
            if(thisRun!==runId)return;
          }catch {if(thisRun===runId)finish('Stopped: unable to store matching grids. Local storage may be full.');return;}
        }
        el('simulation-status').textContent=`Trial ${completed.toLocaleString()} generated successfully.`;
      }else {failed++;el('simulation-status').textContent=`Trial ${completed.toLocaleString()} unsuccessful: ${event.data.error ?? 'Unknown error'}`;}
      progress();if(completed>=target){finish('Simulation complete.');return;}
      attempts=0;worker?.postMessage(selectedOptions);
    };
    worker.onerror=()=>finish('Simulation stopped because the generation worker failed. Completed results are retained.');
    worker.postMessage(selectedOptions);
  }catch {if(thisRun===runId)finish('Unable to start simulation. Local browser storage and web workers are required.');}
});
window.addEventListener('pagehide',()=>{runId++;worker?.terminate();if(timer)clearInterval(timer);store?.dispose();});
histogram();
validateGeneration();
