import './style.css';
import './cages.css';
import './combinations.css';
import { combinationTable } from './engine/combinations';
import { header, footer, setupAbout } from './shell';

const sizes = Array.from({ length: 8 }, (_, i) => i + 2);
document.querySelector('#app')!.innerHTML = `${header}
<main class="combinations-page" id="top">
  <a class="back-link" href="./">← Back to generator</a>
  <h1>Full Combinations Reference Table</h1>
  <p class="toolkit-intro">Every possible set of distinct digits from 1–9 for cages of 2–9 cells, grouped by clue sum. Digits are shown in ascending order; their positions in the cage are not fixed. Sudoku constraints may rule out some sets for a particular cage.</p>
  <p class="reference-source">Reference: <a href="https://www.kakuroconquest.com/blog/kakuro-combinations#2-cell" target="_blank" rel="noreferrer">Kakuro Conquest’s combinations guide</a>. These tables are calculated directly from the distinct-digit sum rule.</p>
  <nav class="combination-jumps" aria-label="Jump to cage size">${sizes.map(size => `<a href="#${size}-cell">${size}-cell sums</a>`).join('')}</nav>
  <p class="reference-key">502 combinations · 120 sums · <span class="unique-tag">Unique</span> means just one digit set is possible.</p>
  ${sizes.map(size => {
    const rows = combinationTable(size);
    const count = rows.reduce((sum, row) => sum + row.combinations.length, 0);
    return `<section class="combination-section" id="${size}-cell" aria-labelledby="heading-${size}">
      <div class="combination-heading"><h2 id="heading-${size}">${size}-cell sums</h2><a href="#top">Back to top ↑</a></div>
      <table class="combination-table">
        <caption>${count} combinations · sums ${rows[0].sum}–${rows.at(-1)!.sum}</caption>
        <thead><tr><th scope="col">Clue sum</th><th scope="col">Valid digit combinations</th></tr></thead>
        <tbody>${rows.map(row => `<tr><th scope="row">${row.sum}</th><td><div class="digit-sets">${row.combinations.map(digits => `<span class="digit-set">${digits.join(', ')}</span>`).join('')}${row.combinations.length === 1 ? '<span class="unique-tag">Unique</span>' : ''}</div></td></tr>`).join('')}</tbody>
      </table>
    </section>`;
  }).join('')}
</main>${footer}`;
setupAbout();
