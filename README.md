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

`src/engine/cages.ts` constructs candidate layouts without changing the completed grid. Cage pairs are placed together and checked for distinct digits on both sides. `src/engine/verifiedGenerator.ts` accepts a candidate only after the exact step solver solves all 81 cells from blank using cages and sums alone. Every step preserves the solution set, so a complete logical path proves uniqueness as well as solvability. The final solution is validated and compared with the construction grid only after the proof is complete. No brute-force solver, guessing, or solution counter is used for acceptance.

Generation favors smaller permitted cages for stronger clues and also tries the full selected size range. Selected sizes are allowed sizes, not required quotas. A worker searches up to 1,500 candidates or 45 seconds and reports progress; Cancel stops it immediately. Stalled, contradictory, incomplete, timed-out, or wrong-difficulty proofs are rejected. If no puzzle qualifies, the previous puzzle is preserved. Nine-cell-only cages are rejected because their sum is always 45 and digit permutations prevent uniqueness. Restrictive settings may have no qualifying result; constraints are never silently relaxed.

Choose **Easy**, **Medium**, **Hard**, or **Expert** before generating (default: Easy). These are app-specific technique bands, not sudokUI's score-based rating:

- Easy: cage combinations/remainders, Full House, Naked Single, Hidden Single.
- Medium: locked candidates, naked/hidden pairs and triples.
- Hard: Naked Quadruple, X-Wing, W-Wing, XY-Wing, XYZ-Wing.
- Expert: Hidden Quadruple, Swordfish, Jellyfish, Empty Rectangle, Remote Pairs.

The hardest technique used in the complete verified path determines the rating; the step count and cage sizes do not. The solver exhausts easier bands before trying harder ones, and both generation and interactive solving use the same order. Generation requires an exact level match, never an easier substitute. The board badge, result, and solver introduction display the accepted level and hardest technique. Changing the selector affects only the next generation.

The header's **About** button opens a rules dialog (Close, Escape, or click the backdrop to dismiss). **Techniques** opens the separate `techniques.html` page with all 20 techniques and brief descriptions. Both pages are included in the Vite production build and work at the GitHub Pages base path.

**Combinations** opens `combinations.html`, the full combinations reference with eight tables for 2–9 cells. All 502 distinct-digit combinations are calculated from digits 1–9 and grouped into 120 clue sums. Jump links navigate between tables, and unique digit sets are marked. The page links to the requested Kakuro Conquest reference; no external data request is required to display the tables.

**Hide solution** hides the generated digits, leaving cages and sums. **Next step** starts from an empty solving board, shows candidates, and applies one explained deduction. Cage combinations are filtered using cell-to-digit matching; unsupported candidates are removed, cage remainders are placed, and the imported logical Sudoku techniques operate on the resulting candidates. The solver worker receives only the current solving state and cages, never the generated solution.

**Undo step** restores the previous candidates and placements. **Reset solver** returns to cages and sums only. **Show solution** previews the generated solution without changing solver progress. Candidate display is optional, and affected cells are outlined in gold. Deduction history records the technique, reasoning and exact placements/eliminations.

The step solver reports solved, contradiction, or logical stall explicitly. It does not use the imported Sudoku-only brute-force fallback for Killer puzzles, and never treats a guess as a deduction. Every newly generated puzzle is pre-verified using this same deterministic solver and should replay to completion. The displayed logical step count records the accepted proof length.
