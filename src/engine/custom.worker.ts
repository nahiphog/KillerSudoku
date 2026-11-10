import type { ManualBoard } from './manualPlay';
import { generateCustomPuzzle } from './customBuilder';

self.onmessage = (event: MessageEvent<{ groups: number[][]; entries: ManualBoard }>) => {
  try {
    self.postMessage({ puzzle: generateCustomPuzzle(event.data.groups, {
      onProgress: attempt => self.postMessage({ progress: attempt }),
    }, event.data.entries) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to generate a custom puzzle.' });
  }
};
