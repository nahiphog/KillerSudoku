import { DEFAULT_CAGE_SIZES } from './cages';
import { generateVerifiedPuzzle } from './verifiedGenerator';
import { simulationResult } from './simulation';

// One request per trial lets the page store and display each result before continuing.
self.onmessage = () => {
  try {
    const puzzle = generateVerifiedPuzzle({ dig: true, digPairs: true, symmetric: true,
      retainedCageSizes: DEFAULT_CAGE_SIZES, logicOnly: false }, {
      onProgress: attempt => self.postMessage({ attempt }),
    });
    self.postMessage({ result: simulationResult(puzzle) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Trial failed.' });
  }
};
