import './style.css';
import './cages.css';
import { header, footer, setupAbout } from './shell';
import { parseGridString } from './engine/gridImport';
import type { VerifiedPuzzle } from './engine/verifiedGenerator';

document.querySelector('#app')!.innerHTML=`${header}<main class="import-page"><h1>Import a grid</h1>
<p class="toolkit-intro">Paste a copied grid string to restore its cages, clues, arithmetic, digits and Snyder notations. We’ll verify the puzzle and open its solution walkthrough.</p>
<form id="import-form"><label for="import-string">Grid string</label><textarea id="import-string" required spellcheck="false" placeholder="Paste your grid string here"></textarea>
<div class="import-actions"><button id="import-confirm" type="submit">Import grid</button><button id="import-cancel" type="button" hidden>Cancel import</button></div>
<p id="import-status" role="status" aria-live="polite"></p></form></main>${footer}`;
setupAbout();
const input=document.querySelector<HTMLTextAreaElement>('#import-string')!;
const confirm=document.querySelector<HTMLButtonElement>('#import-confirm')!;
const cancel=document.querySelector<HTMLButtonElement>('#import-cancel')!;
const status=document.querySelector<HTMLElement>('#import-status')!;
let worker:Worker|null=null;
function stop(){worker?.terminate();worker=null;confirm.disabled=false;input.readOnly=false;cancel.hidden=true;}
cancel.addEventListener('click',()=>{stop();status.textContent='Import cancelled. You can edit the string and try again.';});
window.addEventListener('pagehide',stop);
document.querySelector('#import-form')!.addEventListener('submit',event=>{
  event.preventDefault();if(worker)return;
  try {
    parseGridString(input.value);
    worker=new Worker(new URL('./engine/import.worker.ts',import.meta.url),{type:'module'});
    confirm.disabled=true;input.readOnly=true;cancel.hidden=false;
    status.textContent='Verifying uniqueness and preparing the walkthrough…';
    worker.onmessage=(event:MessageEvent<{puzzle?:VerifiedPuzzle;error?:string}>)=>{
      stop();
      if(!event.data.puzzle){status.textContent=event.data.error ?? 'Unable to import this grid.';return;}
      try {
        sessionStorage.setItem('custom-puzzle',JSON.stringify(event.data.puzzle));
        location.href='./?custom=1&import=1';
      } catch {status.textContent='Browser session storage is unavailable. Enable it to open the imported walkthrough.';}
    };
    worker.onerror=()=>{stop();status.textContent='Import failed. Please check the string and try again.';};
    worker.postMessage(input.value);
  } catch(error){stop();status.textContent=error instanceof Error?error.message:'Invalid grid string.';}
});
