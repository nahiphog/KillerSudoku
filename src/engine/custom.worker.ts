import { generateCustomPuzzle } from './customBuilder';

self.onmessage = (event: MessageEvent<number[][]>) => {
  try {
    self.postMessage({ puzzle: generateCustomPuzzle(event.data, {
      onProgress: attempt => self.postMessage({ progress: attempt }),
    }) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to generate a custom puzzle.' });
  }
};
