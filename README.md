# Killer Sudoku

TypeScript + Vite foundation for a Killer Sudoku maker and solver.

Site: https://nahiphog.github.io/KillerSudoku/

Pushes to `main` run tests, build, and deploy through `.github/workflows/deploy.yml`. Vite uses `/KillerSudoku/` as its base path for GitHub Pages.

```sh
npm install
npm run dev
npm test
npm run build
```

Click **Generate** to create a completed, randomized 9×9 Sudoku grid using backtracking. The board starts empty. The responsive site includes an About rules dialog and a separate techniques page.

`src/engine/solver.ts` registers all 20 requested techniques from sudokUI. It exports `findNextStep`, `applyStep`, `solve`, and `countSolutions`. Logical step search excludes brute force by default; pass `true` to opt in. Brute force finds a possible solution, and does not prove a forced digit in puzzles with multiple solutions.

`src/vendor/sudokui/` preserves the original solving code. See `THIRD_PARTY_NOTICES.md` for the pinned source and GPL-3.0 license.

Click **Generate** to create a completed grid and cages together. Every cage is orthogonally connected and contains distinct digits. Dashed outlines mark each cage and its sum appears in the top-left cell. All cells have a white background.

Rotational symmetry is enabled by default: rotating a cage's cells 180° produces another cage (the central cage maps to itself). Sums need not match. Size checkboxes allow sizes 2–9; sizes 2, 3, 4, 5, 6 and 7 are selected by default. Settings apply to the next generation. Impossible selections display an explanation and disable generation.

`src/engine/cages.ts` uses bounded backtracking without changing the completed grid. Cage pairs are placed together and checked for distinct digits on both sides. Fallback stripes are used only when their size is selected; rules are never relaxed. Generation runs in a worker, retrying a bounded number of completed grids for restrictive settings. If no layout is found, an error is shown and the previous grid is preserved.

The header's **About** button opens a rules dialog (Close, Escape, or click the backdrop to dismiss). **Techniques** opens the separate `techniques.html` page with all 20 techniques and brief descriptions. Both pages are included in the Vite production build and work at the GitHub Pages base path.

Current scope: completed grid generation, cage generation, and standard Sudoku solver imports. Cage-aware solving, puzzle uniqueness checks, and a solver interface await further instructions. The current solving engine operates on standard Sudoku only; generated cages are not rated or checked for a unique solution after hiding the digits.
