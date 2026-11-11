import type { ManualBoard } from './manualPlay';
import { generateCustomPuzzle } from './customBuilder';

self.onmessage = (event: MessageEvent<{ groups: number[][]; entries: ManualBoard; cageFreeCells?: number[]; operations?: ('sum'|'product')[] }>) => {
  try {
    self.postMessage({ puzzle: generateCustomPuzzle(event.data.groups, {
      maxMilliseconds: Infinity,
      maxAttempts: Infinity,
      onProgress: attempt => self.postMessage({ progress: attempt }),
    }, event.data.entries, event.data.cageFreeCells, event.data.operations) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to generate a custom puzzle.' });
  }
};
