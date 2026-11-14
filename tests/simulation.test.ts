import { describe, expect, it } from 'vitest';
import { HISTOGRAM_EDGES, histogramBin, matchesSimulation, simulationResult, TRIAL_COUNTS, RATING_THRESHOLDS } from '../src/engine/simulation';
import { generateVerifiedPuzzle } from '../src/engine/verifiedGenerator';
import { countKillerSolutions } from '../src/engine/digging';
import { simulationExportGrid } from '../src/simulationExport';
import { serializeGrid } from '../src/gridExport';
import { parseGridString } from '../src/engine/gridImport';
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
describe('simulation results',()=>{
  it('uses inclusive minimum ratings and treats brute-force exclusion as a display filter',()=>{
    const result={cages:[],rating:1000,elapsedMilliseconds:10,bruteForce:true};
    expect(matchesSimulation(result,1000,false)).toBe(true);
    expect(matchesSimulation(result,1000,true)).toBe(false);
    expect(matchesSimulation({...result,bruteForce:false},1000,true)).toBe(true);
    expect(matchesSimulation(result,2000,false)).toBe(false);
    expect(TRIAL_COUNTS.at(-1)).toBe(1000000);
    expect(RATING_THRESHOLDS).toEqual([0,1000,2000,3000,5000,10000,1000000]);
  });
  it('counts every score exactly once at range boundaries, including the overflow bin',()=>{
    for(let i=0;i<HISTOGRAM_EDGES.length-1;i++){
      expect(histogramBin(HISTOGRAM_EDGES[i])).toBe(i);
      if(i>0)expect(histogramBin(HISTOGRAM_EDGES[i]-1)).toBe(i-1);
    }
    expect(histogramBin(2000000)).toBe(HISTOGRAM_EDGES.length-2);
  });
  it('exports a compact result with the same per-use rating as the generator',()=>{
    const puzzle=generateVerifiedPuzzle({dig:true,digPairs:true,symmetric:true,logicOnly:false}, {random:rng(3)});
    const result=simulationResult(puzzle);
    expect(countKillerSolutions(result.cages)).toBe(1);
    expect(result.rating).toBeGreaterThan(0);
    expect(result.bruteForce).toBe(!!puzzle.techniqueTally['Brute Force']);
    expect(result.elapsedMilliseconds).toBe(puzzle.elapsedMilliseconds);
    expect(result.solution).toBe(puzzle.values.join(''));
    const blank=parseGridString(serializeGrid(simulationExportGrid(result,false)));
    const completed=parseGridString(serializeGrid(simulationExportGrid(result,true)));
    expect(blank.entries.values).toEqual(Array(81).fill(0));
    expect(completed.entries.values).toEqual(puzzle.values);
    expect(blank.cages).toEqual(puzzle.cages);
    expect(completed.cages).toEqual(puzzle.cages);
    expect(blank.entries.notes).toEqual(Array(81).fill(0));
    expect(result).not.toHaveProperty('deductions');
    const withSearch=simulationResult({...puzzle,techniqueTally:{'Brute Force':2,'Cage combinations':3}});
    expect(withSearch.rating).toBe(20009);
  },120000);
});
