import type { SimulationRecord } from './engine/simulation';
import { serializeGrid } from './gridExport';

export interface SimulationWalkthrough { grid: string; trial: number; elapsedMilliseconds: number }

/** Self-contained fragment: works in a separate tab without an opener or shared session storage. */
export function simulationWalkthroughUrl(record: SimulationRecord): string {
  const data: SimulationWalkthrough = {
    grid: serializeGrid({cages:record.cages,values:Array(81).fill(0),notes:Array.from({length:81},()=>[])}),
    trial:record.trial,elapsedMilliseconds:record.elapsedMilliseconds,
  };
  return './#simulation=' + encodeURIComponent(JSON.stringify(data));
}

export function readSimulationWalkthrough(hash: string): SimulationWalkthrough | null {
  if(!hash.startsWith('#simulation='))return null;
  if(hash.length>300000)throw new Error('Simulation grid link is too large.');
  let data: SimulationWalkthrough;
  try {data=JSON.parse(decodeURIComponent(hash.slice('#simulation='.length)));}
  catch {throw new Error('Invalid simulation grid link.');}
  if(!data || typeof data.grid!=='string' || data.grid.length>100000 || !Number.isSafeInteger(data.trial) || data.trial<1
    || !Number.isFinite(data.elapsedMilliseconds) || data.elapsedMilliseconds<0)throw new Error('Invalid simulation grid link.');
  return data;
}
