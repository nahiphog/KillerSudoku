import type { SimulationResult } from './engine/simulation';
import type { ExportGrid } from './gridExport';

export function simulationExportGrid(result: SimulationResult, completed: boolean): ExportGrid {
  return {cages: result.cages, values: completed ? result.solution.split('').map(Number) : Array(81).fill(0),
    notes: Array.from({length:81},()=>[])};
}
