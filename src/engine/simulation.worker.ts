import { generateVerifiedPuzzle } from './verifiedGenerator';
import { simulationResult } from './simulation';

// One request per trial lets the page store and display each result before continuing.
self.onmessage = () => {
  try {
    const puzzle = generateVerifiedPuzzle({ dig: true, digPairs: true, symmetric: true, logicOnly: false }, {
      onProgress: attempt => self.postMessage({ attempt }),
    });
    self.postMessage({ result: simulationResult(puzzle) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Trial failed.' });
  }
};
