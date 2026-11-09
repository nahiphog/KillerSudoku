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

Click **Generate** to create a completed, randomized 9×9 Sudoku grid using backtracking. The board starts empty. The responsive page includes the Killer Sudoku rules and an expandable list of imported techniques.

`src/engine/solver.ts` registers all 20 requested techniques from sudokUI. It exports `findNextStep`, `applyStep`, `solve`, and `countSolutions`. Logical step search excludes brute force by default; pass `true` to opt in. Brute force finds a possible solution, and does not prove a forced digit in puzzles with multiple solutions.

`src/vendor/sudokui/` preserves the original solving code. See `THIRD_PARTY_NOTICES.md` for the pinned source and GPL-3.0 license.

After generating a completed grid, click **Generate cages** to partition all 81 cells into orthogonally connected cages of 2–5 cells, with distinct digits in each cage. Dashed outlines mark each cage and its sum appears in the top-left cell. Click again to regenerate cages on the same solution. Generating a new grid clears the previous cages.

`src/engine/cages.ts` generates cages without changing the completed grid. Randomized merging retries partitions that leave singletons; a bounded fallback to horizontal triples guarantees completion.

Current scope: completed grid generation, cage generation, and standard Sudoku solver imports. Cage-aware solving, puzzle uniqueness checks, and a solver interface await further instructions. The current solving engine operates on standard Sudoku only; generated cages are not rated or checked for a unique solution after hiding the digits.
