import { generateVerifiedPuzzle, type PuzzleOptions } from './verifiedGenerator';
import { simulationResult } from './simulation';

// One request per trial lets the page store and display each result before continuing.
self.onmessage = (event: MessageEvent<PuzzleOptions>) => {
  try {
    const puzzle = generateVerifiedPuzzle(event.data, {
      onProgress: attempt => self.postMessage({ attempt }),
    });
    self.postMessage({ result: simulationResult(puzzle) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Trial failed.' });
  }
};
