import { generateFullGrid } from './generator';
import { cageOptionsError, generateCages, type CageOptions } from './cages';

self.onmessage = (event: MessageEvent<CageOptions>) => {
  const options = event.data;
  const error = cageOptionsError(options);
  if (error) { self.postMessage({ error }); return; }
  for (let attempt = 0; attempt < 8; attempt++) {
    const grid = generateFullGrid();
    try {
      const cages = generateCages(grid.values, options);
      self.postMessage({ values: Array.from(grid.values), cages });
      return;
    } catch { /* Try a different solution without relaxing the requested rules. */ }
  }
  self.postMessage({ error: 'Could not find a layout with these settings. Try again or select more cage sizes.' });
};
