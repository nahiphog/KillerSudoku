import { combinationTable } from './combinations';
import { customLayoutError, cageFreeCellsError } from './customBuilder';
import { customEntryGrid } from './customEntries';
import { countKillerSolutions } from './digging';
import { traceLogically, type VerifiedPuzzle } from './verifiedGenerator';
import type { Cage } from './cages';
import { newManualBoard } from './manualPlay';

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function cell(value: unknown): number {
  if(typeof value !== 'string' || !/^R[1-9]C[1-9]$/.test(value)) throw new Error('Cell positions must use R1C1 through R9C9.');
  return (Number(value[1])-1)*9+Number(value[3])-1;
}
function cellList(value: unknown): number[] {
  if(!Array.isArray(value) || value.length>81) throw new Error('Invalid cell list.');
  const cells=value.map(cell);
  if(new Set(cells).size!==cells.length) throw new Error('A cell list contains duplicates.');
  return cells;
}

export function parseGridString(text: string) {
  if(text.length>100000) throw new Error('This grid string is too large.');
  let data: unknown;
  try {data=JSON.parse(text.trim());} catch {throw new Error('Paste a complete grid string copied with Copy grid string.');}
  if(!object(data) || data.format!=='killer-sudoku' || data.version!==1 || data.size!==9) throw new Error('Unsupported grid format or version.');
  if(typeof data.digits!=='string' || !/^[0-9]{81}$/.test(data.digits)) throw new Error('The digits field must contain exactly 81 digits (0 for blank).');
  if(!Array.isArray(data.cages) || data.cages.length>81) throw new Error('Invalid cages.');
  const cages: Cage[]=data.cages.map((cage: unknown)=>{
    if(!object(cage)) throw new Error('Invalid cage.');
    const operation = cage.operation ?? 'sum';
    if(operation !== 'sum' && operation !== 'product') throw new Error('Invalid cage operation.');
    const target = operation === 'product' ? cage.product : cage.sum;
    if(target===null) throw new Error('This is an unfinished custom layout without cage sums. Generate its sums before copying a grid for the walkthrough.');
    const cells=cellList(cage.cells).sort((a,b)=>a-b), n=cells.length;
    if(n<1 || n>9 || typeof target!=='number' || !Number.isInteger(target) || !(n===1 ? target>=1 && target<=9 : combinationTable(n,operation).some(row=>row.sum===target))) throw new Error('A cage target is invalid for its operation and distinct digits.');
    return {cells,sum:target,...(operation === 'product' ? {operation: 'product' as const} : {})};
  });
  const cageFreeCells=data.cageFreeCells===undefined ? [] : cellList(data.cageFreeCells);
  const layoutError=cageFreeCellsError(cages.map(c=>c.cells),cageFreeCells) ?? (cages.length ? customLayoutError(cages.map(c=>c.cells)) : null);
  if(layoutError) throw new Error(layoutError);
  const covered=new Set(cages.flatMap(c=>c.cells));
  if(data.uncagedCells!==undefined) {
    const uncaged=cellList(data.uncagedCells);
    if(uncaged.length!==81-covered.size || uncaged.some(c=>covered.has(c))) throw new Error('The uncaged-cell list does not match the cage positions.');
  }
  const entries=newManualBoard();entries.values=data.digits.split('').map(Number);
  if(!object(data.notes)) throw new Error('Invalid Snyder notations.');
  for(const [position,digits] of Object.entries(data.notes)) {
    const index=cell(position);
    if(!Array.isArray(digits) || digits.length>9 || digits.some(d=>!Number.isInteger(d) || d<1 || d>9) || new Set(digits).size!==digits.length) throw new Error('Snyder notations must contain distinct digits from 1 to 9.');
    entries.notes[index]=digits.reduce((mask,digit)=>mask | (1<<(digit-1)),0);
  }
  customEntryGrid(entries,cages.map(c=>c.cells));
  return {cages,entries,cageFreeCells};
}

export function importGridString(text: string, deadline=Infinity): VerifiedPuzzle {
  const started=performance.now();
  const {cages,entries,cageFreeCells}=parseGridString(text);
  const initial=customEntryGrid(entries,cages.map(c=>c.cells));
  const count=countKillerSolutions(cages,deadline,undefined,initial);
  if(!count) throw new Error('The cages, digits and Snyder notations have no solution.');
  if(count!==1) throw new Error('This grid has multiple solutions. A unique solution is required for a verified walkthrough.');
  const proof=traceLogically(cages,deadline,true,initial);
  if(!proof?.complete) throw new Error('Unable to complete the walkthrough for this grid.');
  return {cages,entries,cageFreeCells,values:proof.values,logicallySolved:!proof.techniqueTally['Brute Force'],
    proofSteps:proof.steps,deductions:proof.deductions,techniqueTally:proof.techniqueTally,
    difficulty:proof.difficulty,hardestTechnique:proof.steps ? proof.hardestTechnique : 'None (already solved)',attempts:0,elapsedMilliseconds:performance.now()-started};
}
