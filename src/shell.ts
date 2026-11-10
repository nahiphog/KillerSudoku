export const header = `
<header class="site-header">
  <a class="brand" href="./"><span class="brand-icon" aria-hidden="true">▦</span> Killer Sudoku</a>
  <nav aria-label="Main navigation"><a href="./techniques.html">Techniques</a><a href="./combinations.html">Combinations</a><button id="about" type="button">About</button></nav>
</header>`;
export const footer = `
<footer><span>Built one possibility at a time.</span><span>Solving engine adapted from <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">sudokUI</a> · GPL-3.0</span></footer>
<dialog id="about-dialog" aria-labelledby="about-title">
  <h2 id="about-title">About Killer Sudoku</h2>
  <p>Fill each row, column and 3 × 3 box with the digits 1–9, without repeating a digit.</p>
  <p>The digits inside each dashed cage must add up to the sum in its corner. No digit may repeat within a cage.</p>
  <p>Generate creates a completed grid and its cages. Rotational symmetry matches cage shapes after a half-turn; their sums may differ.</p>
  <p>Optional cage digging removes cages while preserving a unique solution. Cells outside cages follow normal Sudoku rules; the remaining cage layout may no longer be symmetric.</p>
  <form method="dialog"><button autofocus>Close</button></form>
</dialog>`;
export function setupAbout() {
  const dialog = document.querySelector<HTMLDialogElement>('#about-dialog')!;
  document.querySelector('#about')!.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  } });
}
