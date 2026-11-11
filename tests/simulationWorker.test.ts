import { expect, it, vi } from 'vitest';
import type { PuzzleOptions } from '../src/engine/verifiedGenerator';
import type { SimulationResult } from '../src/engine/simulation';
import { cageDigGroups, countKillerSolutions } from '../src/engine/digging';

it('uses each trial request for arithmetic, sizes, retention and digging',async()=>{
  const messages: {result?:SimulationResult;error?:string;attempt?:number}[]=[];
  const host: {onmessage:((event:MessageEvent<PuzzleOptions>)=>void)|null;postMessage:(value:typeof messages[number])=>void}={onmessage:null,postMessage:value=>messages.push(value)};
  vi.stubGlobal('self',host);
  let seed=3;
  vi.spyOn(Math,'random').mockImplementation(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
  try {
    await import('../src/engine/simulation.worker');
    host.onmessage!(new MessageEvent<PuzzleOptions>('message',{data:{operation:'sum',sizes:[1],retainedCageSizes:[1],dig:false,symmetric:false,logicOnly:true}}));
    const first=messages.at(-1)!;
    expect(first.error).toBeUndefined();
    expect(first.result!.cages).toHaveLength(81);
    expect(first.result!.cages.every(c=>c.cells.length===1&&c.operation!=='product')).toBe(true);
    messages.length=0;seed=3;
    host.onmessage!(new MessageEvent<PuzzleOptions>('message',{data:{operation:'product',sizes:[1,2,3],retainedCageSizes:[1,2,3],dig:true,digPairs:true,digSingletons:true,symmetric:true,logicOnly:true}}));
    const second=messages.at(-1)!;
    expect(second.error).toBeUndefined();
    expect(second.result!.cages.every(c=>c.operation==='product'&&c.cells.length>1)).toBe(true);
    for(const size of [2,3])expect(second.result!.cages.some(c=>c.cells.length===size)).toBe(true);
    expect(second.result!.bruteForce).toBe(false);
    expect(()=>cageDigGroups(second.result!.cages,true)).not.toThrow();
    expect(countKillerSolutions(second.result!.cages)).toBe(1);
    expect(messages.some(message=>message.attempt!==undefined)).toBe(true);
  } finally {vi.restoreAllMocks();vi.unstubAllGlobals();}
},120000);
