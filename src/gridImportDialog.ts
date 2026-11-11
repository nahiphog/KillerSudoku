import { parseGridString } from './engine/gridImport';
import type { VerifiedPuzzle } from './engine/verifiedGenerator';

export const importButton='<button id="open-import" type="button">Import grid string</button>';

export function setupGridImport(accept:(puzzle:VerifiedPuzzle)=>void) {
  const dialog=document.createElement('dialog');dialog.className='grid-import-dialog';
  dialog.setAttribute('aria-labelledby','import-title');
  dialog.innerHTML=`<h2 id="import-title">Import grid string</h2><p>Paste a string from Copy grid string. Cage positions, sums, digits and Snyder notations will be restored. We’ll verify uniqueness and build a walkthrough from those entries.</p><label for="import-string">Grid string</label><textarea id="import-string" spellcheck="false"></textarea><p id="import-status" role="status" aria-live="polite"></p><div class="import-actions"><button id="import-confirm" type="button">Import grid</button><button id="import-cancel" type="button">Cancel</button></div>`;
  document.body.append(dialog);
  const input=dialog.querySelector<HTMLTextAreaElement>('textarea')!;
  const status=dialog.querySelector<HTMLElement>('#import-status')!;
  const confirm=dialog.querySelector<HTMLButtonElement>('#import-confirm')!;
  const cancel=dialog.querySelector<HTMLButtonElement>('#import-cancel')!;
  let worker:Worker|null=null;
  const stop=()=>{worker?.terminate();worker=null;confirm.disabled=false;input.readOnly=false;cancel.textContent='Cancel';};
  document.querySelector('#open-import')!.addEventListener('click',()=>{status.textContent='';dialog.showModal();input.focus();});
  dialog.addEventListener('close',stop);
  cancel.addEventListener('click',()=>{stop();dialog.close();});
  confirm.addEventListener('click',()=>{
    if(worker) return;
    try {
      parseGridString(input.value);
      worker=new Worker(new URL('./engine/import.worker.ts',import.meta.url),{type:'module'});
      confirm.disabled=true;input.readOnly=true;cancel.textContent='Cancel import';
      status.textContent='Verifying the imported grid and preparing its walkthrough…';
      worker.onmessage=(event:MessageEvent<{puzzle?:VerifiedPuzzle;error?:string}>)=>{
        stop();
        if(event.data.puzzle) {accept(event.data.puzzle);dialog.close();}
        else status.textContent=event.data.error ?? 'Unable to import this grid. Your existing grid is unchanged.';
      };
      worker.onerror=()=>{stop();status.textContent='Import failed. Your existing grid is unchanged. Please try again.';};
      worker.postMessage(input.value);
    } catch(error) {stop();status.textContent=error instanceof Error ? error.message : 'Invalid grid string.';}
  });
}
