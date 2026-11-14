import { afterEach, describe, expect, it, vi } from 'vitest';
import { TECHNIQUES, findNextStep, parseGrid } from '../src/engine/solver';
import { nextKillerStep, startSolver } from '../src/engine/killerSolver';
import { techniqueScore } from '../src/engine/techniqueScores';
import { traceLogically } from '../src/engine/verifiedGenerator';
import * as ring from '../src/engine/phistomefelRing';
import { bit } from '../src/vendor/sudokui/board';
import type { Tech } from '../src/vendor/sudokui/ratings';
import type { Cage } from '../src/engine/cages';
import examples from './technique-examples.json';

afterEach(()=>vi.restoreAllMocks());

it('reports the hardest technique by numeric rating',()=>{
  const example=examples.REMOTE_PAIR;
  const grid=parseGrid(example.values)!;
  grid.cands=Uint16Array.from(example.cands);
  const trace=traceLogically([],Infinity,false,grid)!;
  expect(trace).not.toBeNull();
  expect(techniqueScore(trace.hardestTechnique)).toBe(
    Math.max(...trace.deductions.map(step=>techniqueScore(step.technique))));
});

it('chooses the lowest available rating on every imported technique example',()=>{
  for(const technique of TECHNIQUES.filter(t=>t.id!=='BRUTE_FORCE')){
    const example=examples[technique.id as keyof typeof examples];
    const grid=parseGrid(example.values)!;
    grid.cands=Uint16Array.from(example.cands);
    const available=TECHNIQUES.filter(t=>t.id!=='BRUTE_FORCE' && t.find(grid));
    const minimum=Math.min(...available.map(t=>techniqueScore(t.name)));
    const classic=findNextStep(grid)!;
    expect(techniqueScore(TECHNIQUES.find(t=>t.id===classic.tech)!.name)).toBe(minimum);
    const result=nextKillerStep(grid,[]);
    expect(result.status).toBe('step');
    if(result.status==='step')expect(techniqueScore(result.step.technique))
      .toBe(Math.min(minimum,ring.findPhistomefelRing(grid)?200:Infinity));
  }
});

describe.each(['sum','product','mixed','psycho'] as const)('%s priority',mode=>{
  function fixture(){
    const grid=startSolver();
    grid.cands[0]=grid.cands[1]=bit(1)|bit(2);
    const cages:Cage[]=[{cells:[0,1],sum:mode==='product'?2:3,
      operation:mode==='mixed'?'sum':mode}];
    if(mode==='mixed'){
      grid.cands[9]=grid.cands[10]=bit(3)|bit(4);
      cages.push({cells:[9,10],sum:12,operation:'product'});
    }
    const finders=new Map(TECHNIQUES.map(t=>[t.id,vi.spyOn(t,'find').mockReturnValue(null)]));
    const offer=(id:Tech)=>finders.get(id)!.mockReturnValue({tech:id,
      placements:[],eliminations:[{cell:40,digit:9}],description:id});
    return {grid,cages,finders,offer};
  }

  it('uses Remote Pairs (110) before Naked Quadruple (120), then restarts at singles',()=>{
    const {grid,cages,finders,offer}=fixture();
    offer('REMOTE_PAIR');offer('NAKED_QUADRUPLE');
    expect(nextKillerStep(grid,cages)).toMatchObject({status:'step',step:{technique:'Remote Pairs'}});
    expect(finders.get('NAKED_QUADRUPLE')).not.toHaveBeenCalled();
    offer('NAKED_SINGLE');
    expect(nextKillerStep(grid,cages)).toMatchObject({status:'step',step:{technique:'Naked Single'}});
  });

  it('tries Swordfish (150) before Phistomefel Ring (200)',()=>{
    const {grid,cages,offer}=fixture();
    offer('SWORDFISH');
    const ringFinder=vi.spyOn(ring,'findPhistomefelRing');
    expect(nextKillerStep(grid,cages)).toMatchObject({status:'step',step:{technique:'Swordfish'}});
    expect(ringFinder).not.toHaveBeenCalled();
  });

  it('uses cage deductions (3) before singles (4)',()=>{
    const {grid,cages,finders,offer}=fixture();
    grid.cands[0]|=bit(9);
    offer('NAKED_SINGLE');
    expect(nextKillerStep(grid,cages)).toMatchObject({status:'step',step:{technique:'Cage combinations'}});
    expect(finders.get('NAKED_SINGLE')).not.toHaveBeenCalled();
  });
});
