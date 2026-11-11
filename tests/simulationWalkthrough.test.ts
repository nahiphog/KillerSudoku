import { expect, it } from 'vitest';
import { simulationWalkthroughUrl, readSimulationWalkthrough } from '../src/simulationWalkthrough';
import { simulationResult } from '../src/engine/simulation';
import { generateVerifiedPuzzle } from '../src/engine/verifiedGenerator';
import { importGridString, parseGridString } from '../src/engine/gridImport';
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

it.each(['sum','product'] as const)('rebuilds the original %s walkthrough from a standalone link',operation=>{
  const puzzle=generateVerifiedPuzzle({operation,sizes:[2,3],dig:true,logicOnly:false},{random:rng(3)});
  const record={...simulationResult(puzzle),trial:42,displayedAt:Date.now()};
  const url=simulationWalkthroughUrl(record);
  const request=readSimulationWalkthrough(url.slice(url.indexOf('#')))!;
  expect(request.trial).toBe(42);
  expect(request.elapsedMilliseconds).toBe(puzzle.elapsedMilliseconds);
  const parsed=parseGridString(request.grid);
  expect(parsed.cages).toEqual(puzzle.cages);
  expect(parsed.entries.values.every(value=>value===0)).toBe(true);
  const restored=importGridString(request.grid);
  expect(restored.values).toEqual(puzzle.values);
  expect(restored.techniqueTally).toEqual(puzzle.techniqueTally);
  expect(restored.deductions).toEqual(puzzle.deductions);
  expect(simulationResult(restored).rating).toBe(record.rating);
},120000);

it('ignores ordinary page anchors and rejects malformed simulation links',()=>{
  expect(readSimulationWalkthrough('#generate')).toBeNull();
  expect(()=>readSimulationWalkthrough('#simulation=%')).toThrow('Invalid');
  expect(()=>readSimulationWalkthrough('#simulation='+encodeURIComponent(JSON.stringify({grid:'{}',trial:0,elapsedMilliseconds:10})))).toThrow('Invalid');
});
