import { nextKillerStep } from './killerSolver';
import type { Grid } from '../vendor/sudokui/board';
import type { Cage } from './cages';

self.onmessage = (event: MessageEvent<{ grid: Grid; cages: Cage[] }>) => {
  try { self.postMessage(nextKillerStep(event.data.grid, event.data.cages)); }
  catch { self.postMessage({ status: 'contradiction', message: 'Unable to analyze this board. Reset the solver and try again.' }); }
};
