import { generateVerifiedPuzzle, type PuzzleOptions } from './verifiedGenerator';

self.onmessage = (event: MessageEvent<PuzzleOptions>) => {
  try {
    self.postMessage(generateVerifiedPuzzle(event.data, {
      onProgress: attempt => self.postMessage({ progress: attempt }),
    }));
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to verify a puzzle. Please try again.' });
  }
};
