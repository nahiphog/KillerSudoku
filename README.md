# Killer Sudoku

TypeScript + Vite foundation for a Killer Sudoku maker and solver.

**Custom Build** opens `custom.html` with an empty grid. Select connected cells (click/tap, or arrow keys and Space), then choose **Add cage**. Cages contain 1–9 cells and cannot overlap; select an existing cage to edit or delete it. Unassigned cells are allowed and obey normal Sudoku rules. **Generate unique puzzle** searches for sums while preserving every cage shape, using an exact solution count from the entered clues and candidate restrictions to certify uniqueness. The search runs in a cancellable worker for up to 45 seconds / 1,500 candidates; failure preserves the layout and does not prove it impossible. **View generated grid** opens the verified result in the read-only Generate page through session storage. The logical walkthrough can be partial even though uniqueness is verified.

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

`src/engine/cages.ts` constructs candidate layouts without changing the completed grid. Cage pairs are placed together and checked for distinct digits on both sides. `src/engine/verifiedGenerator.ts` accepts a candidate only after the exact step solver solves all 81 cells from blank using cages and sums alone. Every step preserves the solution set, so a complete logical path proves uniqueness as well as solvability. The final solution is validated and compared with the construction grid only after the proof is complete. Standard generation does not use a brute-force solver, guessing, or solution counter for acceptance. Optional digging uses a separate exact solution counter.

Generation favors smaller permitted cages for stronger clues and also tries the full selected size range. Selected sizes are allowed sizes, not required quotas. A worker searches up to 1,500 candidates or 45 seconds and reports progress; Cancel stops it immediately. Stalled, contradictory, incomplete, timed-out, or unverified proofs are rejected. If no puzzle qualifies, the previous puzzle is preserved. Nine-cell-only cages are rejected because their sum is always 45 and digit permutations prevent uniqueness. Restrictive settings may have no qualifying result; constraints are never silently relaxed.

Generation accepts any difficulty. The first candidate with a complete logical proof is accepted; its rating is reported afterwards for information only. Technique ratings and tally scores do not filter generation.

**Settings**, immediately left of **About** on the generator page, opens a dialog containing the cage-size checkboxes and rotational symmetry. Changes apply to the next puzzle. Done, Escape, or the backdrop closes the dialog. Invalid selections show an error and disable Generate until corrected.

The header's **About** button opens a rules dialog (Close, Escape, or click the backdrop to dismiss). **Techniques** opens the separate `techniques.html` page with all 20 techniques and brief descriptions. Both pages are included in the Vite production build and work at the GitHub Pages base path.

**Combinations** opens `combinations.html`, the full combinations reference with eight tables for 2–9 cells. All 502 distinct-digit combinations are calculated from digits 1–9 and grouped into 120 clue sums. Jump links navigate between tables, and unique digit sets are marked. The page links to the requested Kakuro Conquest reference; no external data request is required to display the tables.

**The Generate page is read-only.** Manual play, keyboard digit entry, pencil marks, erasing and the number pad are temporarily unavailable. Cells cannot be edited. **Show solution** previews the completed grid, while the walkthrough slider and step buttons display recorded deductions. The manual-play engine remains available in the source for later restoration.

**Undo step** restores the previous candidates and placements. **Reset solver** returns to cages and sums only. **Show solution** previews the generated solution without changing solver progress. Candidate display is optional, and affected cells are outlined in gold. Deduction history records the technique, reasoning and exact placements/eliminations.

The step solver reports solved, contradiction, or logical stall explicitly. It does not use the imported Sudoku-only brute-force fallback for Killer puzzles, and never treats a guess as a deduction. Every standard puzzle is pre-verified using this same deterministic solver and replays to completion. **Require a complete logical solve** is enabled by default on Generate. It applies to the next generated puzzle: all 81 cells must be solved using cage combinations and imported logical techniques, without Brute Force. Each proposed cage removal must preserve both uniqueness and that complete logical solve. Retained cages are rechecked after successful removals until no further qualifying removal is found; the final complete proof is verified again before acceptance. Uncheck it to dig using uniqueness alone and allow cage-aware Brute Force for one placement before retrying logic. Uniqueness verification during digging still uses exact search, independently of this walkthrough setting. Each search placement is labeled Brute Force and rated 10000 per use. The generated answer is never passed to the walkthrough search.

**Generate** is at the top of the page and switches to **Cancel generation** while busy. Cancelling preserves the previous puzzle. **Puzzle statistics** lists Technique, Rating and Steps, sorted by rating. Each individual step number links to that walkthrough position; there is no total row. Directly below Generate, the enlarged puzzle summary shows the cage count, construction time and cumulative difficulty rating (the sum of per-step ratings, including 10000 per Brute Force placement).

The **Solution walkthrough** slider moves from step 0 (empty board) to the complete solution. Drag it or use arrow keys, Home, and End. Each position restores its candidates, placements, highlighted cells and explanation. Next step, Undo step and Reset solver share the same position; moving backward does not discard later steps. The walkthrough explanation appears above Puzzle statistics.

**Dig cages after generation**, beside Generate (enabled by default), starts with a full-coverage, zero-given, uniquely solvable puzzle. It shuffles the removal groups (symmetric pairs by default) and tries deleting each group, preserving a deletion only when an exact Killer Sudoku search confirms exactly one solution. Removing a cage removes both its sum and its no-repeat constraint; uncovered cells retain ordinary Sudoku rules. With the complete logical solve requirement enabled, removals must also preserve a full logical proof, and retained groups are rechecked until none can be removed under both requirements. With that option disabled, a single random pass is sufficient because a rejected removal cannot become unique after more constraints are removed. The result is irreducible under the selected requirements and removal groups, not necessarily the globally smallest cage set.

The result is titled **Dug-killer grid** and shows its remaining cage count. Purple dashed outlines mark the cages. **Dig cages in pairs** is enabled by default beside the digging toggle; it is available when digging and rotational symmetry are enabled. A cage and its 180-degree counterpart are removed together only if the result remains unique; a self-symmetric central cage is tested once. Turning pairs off restores individual cage digging. The stopping guarantee applies to the selected removal groups, not necessarily individual cages in pair mode. Digging has a 120-second verification budget and can be cancelled. A timeout never publishes an unfinished dig.

Standard grids remain centered at 70% of their previous width and height. Dug-killer grids fill the available viewport width with small outer margins. The walkthrough explanation and one full-width statistics panel follow below it. Both generation pages display a real-time elapsed timer (updated every 0.1 seconds) until completion, cancellation or failure.

Custom Build has separate **Cages**, **Digits** and **Snyder notations** modes. Use the keyboard or number pad; P toggles notations and Delete/Backspace/Erase clears a cell. Digits are fixed clues. A cell with notations is restricted to exactly those digits; a blank cell is unrestricted. Each notation appears in its corresponding 3×3 position. Entries participate in construction and exact uniqueness verification, and are retained in the read-only viewer and walkthrough. Generation also supports entries without cages. Conflicting entries are reported before generation.

The browser tab uses a green grid favicon matching the header logo on every page. The generated puzzle summary includes its hardest technique beside the difficulty rating. **Retain at least one cage of each selected size** offers independent checkboxes for sizes 2–9. Every selected size must appear exactly in at least one final cage, and must also be enabled in Settings. Construction and every proposed removal enforce all selections alongside uniqueness and the logical-solve requirement. No sizes are selected by default.

Custom Build uses square cells and a **Cage-free cells** mode. Click or press Space on a cell to toggle its × tag. Tagged cells cannot be added to cages; remove an existing cage before tagging its cells. Tags may coexist with digits and Snyder notations. The worker validates the exclusion list and retains it with the generated result.
