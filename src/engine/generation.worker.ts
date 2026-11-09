import { generateVerifiedPuzzle } from './verifiedGenerator';
import type { CageOptions } from './cages';

self.onmessage = (event: MessageEvent<CageOptions>) => {
  try {
    self.postMessage(generateVerifiedPuzzle(event.data, {
      onProgress: attempt => self.postMessage({ progress: attempt }),
    }));
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to verify a puzzle. Please try again.' });
  }
};
