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

Generation favors smaller permitted cages for stronger clues and also tries the full selected size range. Selected sizes are allowed sizes, not required quotas. A worker searches up to 1,500 candidates or 45 seconds and reports progress; Cancel stops it immediately. Stalled, contradictory, incomplete, timed-out, or unverified proofs are rejected. If no puzzle qualifies, the previous puzzle is preserved. Nine-cell-only cages are rejected because their sum is always 45 and digit permutations prevent uniqueness. Restrictive settings may have no qualifying result; constraints are never silently relaxed.

Generation accepts any difficulty. The first candidate with a complete logical proof is accepted; its rating is reported afterwards for information only. Technique ratings and tally scores do not filter generation.

**Settings**, immediately left of **About** on the generator page, opens a dialog containing the cage-size checkboxes and rotational symmetry. Changes apply to the next puzzle. Done, Escape, or the backdrop closes the dialog. Invalid selections show an error and disable Generate until corrected.

The header's **About** button opens a rules dialog (Close, Escape, or click the backdrop to dismiss). **Techniques** opens the separate `techniques.html` page with all 20 techniques and brief descriptions. Both pages are included in the Vite production build and work at the GitHub Pages base path.

**Combinations** opens `combinations.html`, the full combinations reference with eight tables for 2–9 cells. All 502 distinct-digit combinations are calculated from digits 1–9 and grouped into 120 clue sums. Jump links navigate between tables, and unique digit sets are marked. The page links to the requested Kakuro Conquest reference; no external data request is required to display the tables.

**Play manually** is the default view for a new puzzle, showing only cages and sums. Click a cell and type 1–9 or use the number pad. Arrow keys move the selection. **Pencil marks** (P) toggles candidate entry; repeat a candidate to remove it. **Erase**, Backspace, Delete or 0 clears the selected cell. Placing a digit clears its notes. Conflicts are marked in red using Sudoku and cage rules without consulting the answer. A valid completed board displays a success message. Progress resets when generating a new puzzle or reloading the page.

**View solver** shows the separate logical solving board; **Play manually** returns to your preserved entries and notes. **Show solution** previews the answer; **Hide solution** returns to the current view. **Next step** starts from an empty solving board, shows candidates, and applies one explained deduction. Cage combinations are filtered using cell-to-digit matching; unsupported candidates are removed, cage remainders are placed, and the imported logical Sudoku techniques operate on the resulting candidates. The walkthrough replays the exact deductions retained from the generation proof; the logical solver never receives the generated solution.

**Undo step** restores the previous candidates and placements. **Reset solver** returns to cages and sums only. **Show solution** previews the generated solution without changing solver progress. Candidate display is optional, and affected cells are outlined in gold. Deduction history records the technique, reasoning and exact placements/eliminations.

The step solver reports solved, contradiction, or logical stall explicitly. It does not use the imported Sudoku-only brute-force fallback for Killer puzzles, and never treats a guess as a deduction. Every newly generated puzzle is pre-verified using this same deterministic solver and should replay to completion. The displayed logical step count records the accepted proof length.

**Generate** is at the top of the page, directly below the header. **Puzzle statistics** shows total construction and logical verification time (including rejected candidates), candidate attempts, and a per-technique tally for the accepted proof. Counts represent deduction steps, not the number of affected cells.

The **Solution walkthrough** slider moves from step 0 (empty board) to the complete solution. Drag it or use arrow keys, Home, and End. Each position restores its candidates, placements, highlighted cells and explanation. Next step, Undo step and Reset solver share the same position; moving backward does not discard later steps. Manual entries remain separate and preserved.
