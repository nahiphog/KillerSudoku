import { defineConfig } from 'vite';

export default defineConfig({
  base: '/KillerSudoku/',
  build: { rollupOptions: { input: ['index.html', 'techniques.html', 'combinations.html', 'custom.html'] } },
});
