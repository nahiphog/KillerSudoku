export const header = `
<header class="site-header">
  <a class="brand" href="./"><span class="brand-icon" aria-hidden="true">▦</span> Killer Sudoku</a>
  <nav aria-label="Main navigation"><select id="page-navigation" aria-label="Pages"><option value="./#generate">Generate</option><option value="./custom.html">Custom Build</option><option value="./import.html">Import</option><option value="./techniques.html">Techniques</option><option value="./combinations.html">Combinations</option><option value="./simulation.html">Simulation</option></select><button id="about" type="button">About</button></nav>
</header>`;
export const footer = `
<dialog id="about-dialog" aria-labelledby="about-title">
  <h2 id="about-title">About Killer Sudoku</h2>
  <p>Fill each row, column and 3 × 3 box with the digits 1–9, without repeating a digit.</p>
  <p>The digits inside a sum cage (marked +) add up to its clue. In a product cage (marked ×), multiply the digits to obtain its clue. No digit may repeat within either type of cage.</p>
  <p>Sum + Product puzzles contain at least one cage of each operation, even after digging. In Psycho cages, the clue has no operation symbol: its value is either the sum or the product of the distinct digits. Determine which operation fits as you solve; sometimes both give the same value.</p>
  <p>Generate creates a completed grid and its cages. Rotational symmetry matches cage shapes after a half-turn; their clues may differ.</p>
  <p>Optional cage digging removes cages while preserving a unique solution. Cells outside cages follow normal Sudoku rules; the remaining cage layout may no longer be symmetric.</p>
  <form method="dialog"><button autofocus>Close</button></form>
</dialog>`;
export function setupAbout() {
  const navigation = document.querySelector<HTMLSelectElement>('#page-navigation')!;
  const currentPage = location.pathname.split('/').pop();
  navigation.value = ['import.html', 'custom.html', 'techniques.html', 'combinations.html', 'simulation.html'].includes(currentPage ?? '') ? `./${currentPage}` : './#generate';
  navigation.addEventListener('change', () => { location.href = navigation.value; });
  const dialog = document.querySelector<HTMLDialogElement>('#about-dialog')!;
  document.querySelector('#about')!.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  } });
}
