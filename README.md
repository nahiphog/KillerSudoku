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

**Combinations** opens `combinations.html`, the full combinations reference with eight tables for 2–9 cells. All 502 distinct-digit combinations are calculated from digits 1–9 and grouped into 120 clue sums. Jump links navigate between tables, and unique digit sets are marked. The page links to the requested Kakuro Conquest reference; no external data request is required to display the tables.

**Hide solution** hides the generated digits, leaving cages and sums. **Next step** starts from an empty solving board, shows candidates, and applies one explained deduction. Cage combinations are filtered using cell-to-digit matching; unsupported candidates are removed, cage remainders are placed, and the imported logical Sudoku techniques operate on the resulting candidates. The solver worker receives only the current solving state and cages, never the generated solution.

**Undo step** restores the previous candidates and placements. **Reset solver** returns to cages and sums only. **Show solution** previews the generated solution without changing solver progress. Candidate display is optional, and affected cells are outlined in gold. Deduction history records the technique, reasoning and exact placements/eliminations.

The step solver reports solved, contradiction, or logical stall explicitly. It does not use the imported Sudoku-only brute-force fallback for Killer puzzles, and never treats a guess as a deduction. Generated cages are not rated or checked for a unique solution; some puzzles require stronger reasoning or have multiple solutions.
