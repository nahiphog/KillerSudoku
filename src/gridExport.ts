import type { Cage } from './engine/cages';

export interface ExportGrid {
  cages: { cells: number[]; sum: number | null; operation?: 'sum' | 'product' | 'psycho' }[];
  values: number[];
  notes: number[][];
  cageFreeCells?: number[];
}

const address = (cell: number) => `R${Math.floor(cell / 9) + 1}C${cell % 9 + 1}`;

/** Versioned JSON, with explicit one-based coordinates and row-major digits. */
export function serializeGrid(grid: ExportGrid): string {
  const covered = new Set(grid.cages.flatMap(cage => cage.cells));
  return JSON.stringify({
    format: 'killer-sudoku', version: 1, size: 9,
    digits: grid.values.join(''),
    cages: grid.cages.map(cage => ({ ...(cage.operation === 'psycho' ? {operation:'psycho',target:cage.sum} : cage.operation === 'product' ? {operation:'product',product:cage.sum} : {sum:cage.sum}), cells: [...cage.cells].sort((a,b)=>a-b).map(address) })),
    notes: Object.fromEntries(grid.notes.flatMap((digits, cell) => digits.length ? [[address(cell), digits]] : [])),
    uncagedCells: Array.from({length:81},(_,i)=>i).filter(cell=>!covered.has(cell)).map(address),
    cageFreeCells: (grid.cageFreeCells ?? []).map(address),
  });
}

export function visibleGrid(board: HTMLElement, cages: Cage[] | ExportGrid['cages'], cageFreeCells: number[] = []): ExportGrid {
  const cells = [...board.querySelectorAll('td')];
  return {
    cages: cages.map(cage=>({cells:[...cage.cells],sum:cage.sum,...(cage.operation ? {operation:cage.operation} : {})})), cageFreeCells,
    values: cells.map(cell=>Number(cell.querySelector('.cell-digit, .custom-digit')?.textContent ?? 0)),
    notes: cells.map(cell=>[...cell.querySelectorAll('.cell-candidates > span, .custom-notes > span')]
      .filter(mark=>!mark.classList.contains('removed-candidate')).map(mark=>Number(mark.textContent)).filter(Boolean)),
  };
}

/** Snapshot the visible board and legend, including the current walkthrough colors. */
export function gridImage(board: HTMLElement): Promise<Blob> {
  const bounds = board.getBoundingClientRect();
  const legend = [...board.closest('.board-panel, .simulation-card')?.querySelectorAll<HTMLElement>('.cage-legend > span') ?? []].map(item => ({
    text: item.textContent?.trim() ?? '',
    color: getComputedStyle(item.querySelector('i')!).borderTopColor,
    textColor: getComputedStyle(item).color,
  }));
  const legendHeight = legend.length ? 24 + legend.length * 20 : 0;
  const canvas = document.createElement('canvas');
  const scale = 1440 / bounds.width;
  canvas.width = 1440; canvas.height = Math.ceil((bounds.height + legendHeight) * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Image export is unavailable.'));
  ctx.scale(scale,scale); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,bounds.width,bounds.height + legendHeight);
  const rect = (element: Element) => {
    const r = element.getBoundingClientRect();
    return {x:r.left-bounds.left,y:r.top-bounds.top,w:r.width,h:r.height};
  };
  const borders = (element: Element, dashed = false) => {
    const r=rect(element), style=getComputedStyle(element);
    const edges = [
      ['Top',r.x,r.y,r.x+r.w,r.y], ['Right',r.x+r.w,r.y,r.x+r.w,r.y+r.h],
      ['Bottom',r.x,r.y+r.h,r.x+r.w,r.y+r.h], ['Left',r.x,r.y,r.x,r.y+r.h],
    ] as const;
    for (const [side,x1,y1,x2,y2] of edges) {
      const width=parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`));
      if (!width) continue;
      ctx.lineWidth=width;ctx.strokeStyle=style.getPropertyValue(`border-${side.toLowerCase()}-color`);
      ctx.setLineDash(dashed ? [3,3] : []);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  for (const cell of board.querySelectorAll('td')) {
    const r=rect(cell);ctx.fillStyle=getComputedStyle(cell).backgroundColor;ctx.fillRect(r.x,r.y,r.w,r.h);borders(cell);
  }
  for (const outline of board.querySelectorAll('.cage-outline')) borders(outline,true);
  // Paint filled digits last so they sit above cage clues, matching CSS layering.
  const marks = [...board.querySelectorAll('.cell-candidates > span, .custom-notes > span, .cage-sum, .cage-free-tag'),
    ...board.querySelectorAll('.cell-digit, .custom-digit')];
  for (const mark of marks) {
    if (!mark.textContent) continue;
    const r=rect(mark), style=getComputedStyle(mark);
    ctx.fillStyle=style.backgroundColor;ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle=style.color;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(mark.textContent,r.x+r.w/2,r.y+r.h/2);
    if(style.textDecorationLine.includes('line-through')) {
      ctx.strokeStyle=style.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r.x,r.y+r.h/2);ctx.lineTo(r.x+r.w,r.y+r.h/2);ctx.stroke();
    }
  }
  // Preserve supporting-cell outlines and the links shown in the walkthrough.
  for (const cell of board.querySelectorAll('.support-cell')) {
    const r=rect(cell);ctx.strokeStyle='#7739a5';ctx.lineWidth=2;ctx.strokeRect(r.x+3,r.y+3,r.w-6,r.h-6);
  }
  for (const path of board.parentElement?.querySelectorAll<SVGPathElement>('.candidate-links path') ?? []) {
    const style=getComputedStyle(path);
    ctx.strokeStyle=style.stroke;ctx.lineWidth=parseFloat(style.strokeWidth);
    ctx.setLineDash(style.strokeDasharray === 'none' ? [] : style.strokeDasharray.split(/[ ,]+/).map(parseFloat));
    ctx.stroke(new Path2D(path.getAttribute('d') ?? ''));
  }
  ctx.setLineDash([]);
  borders(board);
  // A compact, centered footer fits even when the on-page legend wraps.
  ctx.font="400 11px 'DM Sans', sans-serif";
  const textWidth = Math.max(0,...legend.map(item=>ctx.measureText(item.text).width));
  const fontSize = Math.min(11,11 * (bounds.width - 56) / Math.max(1,textWidth));
  ctx.font=`400 ${fontSize}px 'DM Sans', sans-serif`;
  const legendWidth = Math.max(0,...legend.map(item=>ctx.measureText(item.text).width)) + 24;
  const legendLeft = (bounds.width - legendWidth) / 2;
  ctx.textAlign='left';ctx.textBaseline='middle';
  legend.forEach((item,index)=>{
    const y=bounds.height + 22 + index * 20;
    ctx.strokeStyle=item.color;ctx.lineWidth=2;ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(legendLeft,y);ctx.lineTo(legendLeft+16,y);ctx.stroke();
    ctx.setLineDash([]);ctx.fillStyle=item.textColor;ctx.fillText(item.text,legendLeft+24,y);
  });
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('Unable to create image.')),'image/png'));
}

export const exportControls = `<div class="grid-export"><button type="button" id="copy-grid-image">Copy grid image</button><button type="button" id="copy-grid-string">Copy grid string</button><p id="copy-status" role="status" aria-live="polite"></p><a id="download-grid-image" hidden download="killer-sudoku.png">Download grid image</a><textarea id="grid-string-fallback" aria-label="Grid string to copy" readonly hidden></textarea></div>`;

export type ExportVariant = 'puzzle' | 'completed';
export function setupGridExport(board: HTMLElement, snapshot: ()=>ExportGrid, variants?: {
  snapshot: (variant: ExportVariant)=>ExportGrid;
  image: (variant: ExportVariant)=>Promise<Blob>;
  available?: ()=>boolean;
}, root: ParentNode = document) {
  const control=<T extends HTMLElement>(id:string)=>root.querySelector<T>(`#${id}, [data-export-control="${id}"]`)!;
  const imageButton=control<HTMLButtonElement>('copy-grid-image');
  const textButton=control<HTMLButtonElement>('copy-grid-string');
  const status=control<HTMLElement>('copy-status');
  const download=control<HTMLAnchorElement>('download-grid-image');
  const fallback=control<HTMLTextAreaElement>('grid-string-fallback');
  let url: string | undefined;
  const copyText=async(getSnapshot:()=>ExportGrid)=>{
    const text=serializeGrid(getSnapshot());fallback.hidden=true;
    try {await navigator.clipboard.writeText(text);status.textContent='Grid string copied, including all cage positions and clues.';}
    catch {fallback.value=text;fallback.hidden=false;fallback.focus();fallback.select();status.textContent='Clipboard access is unavailable. Copy the selected grid string manually.';}
  };
  const copyImage=async(button:HTMLButtonElement,getImage:()=>Promise<Blob>)=>{
    button.disabled=true;download.hidden=true;status.textContent='Copying grid image…';
    const blob=Promise.resolve().then(getImage);
    try {
      // Start the clipboard write during the click gesture, before PNG encoding finishes.
      if(!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Clipboard images unavailable');
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
      status.textContent='Grid image copied.';
    } catch {
      try {
        if(url) URL.revokeObjectURL(url);
        url=URL.createObjectURL(await blob);download.href=url;download.hidden=false;
        status.textContent='Clipboard image access is unavailable. Download the PNG instead.';
      } catch {status.textContent='Unable to create the grid image. Please try again.';}
    } finally {button.disabled=false;}
  };
  textButton.addEventListener('click',()=>void copyText(snapshot));
  imageButton.addEventListener('click',()=>void copyImage(imageButton,()=>gridImage(board)));
  const buttons=[imageButton,textButton];
  const variantGroups: HTMLElement[]=[];
  if(variants){
    imageButton.textContent='Copy current view as image';textButton.textContent='Copy current view as string';
    for(const variant of ['puzzle','completed'] as const){
      const group=document.createElement('div');group.className='export-variant';
      const title=document.createElement('strong');title.textContent=variant==='puzzle'?'Puzzle (cages and original entries)':'Completed grid';group.append(title);
      const image=document.createElement('button');image.type='button';image.textContent='Copy '+(variant==='puzzle'?'puzzle':'completed grid')+' as image';
      image.addEventListener('click',()=>void copyImage(image,()=>variants.image(variant)));
      const text=document.createElement('button');text.type='button';text.textContent='Copy '+(variant==='puzzle'?'puzzle':'completed grid')+' as string';
      text.addEventListener('click',()=>void copyText(()=>variants.snapshot(variant)));
      group.append(image,text);status.before(group);buttons.push(image,text);variantGroups.push(group);
    }
  }
  return (enabled:boolean)=>{
    for(const button of buttons)button.disabled=!enabled;
    const available=variants?.available?.() ?? true;
    for(const group of variantGroups){group.hidden=!available;for(const button of group.querySelectorAll('button'))button.disabled=!enabled || !available;}
  };
}
