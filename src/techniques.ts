import './style.css';
import './cages.css';
import { TECHNIQUES } from './engine/solver';
import { header, footer, setupAbout } from './shell';

const descriptions = [
  'Fill the last empty cell in a row, column or box with its missing digit.',
  'Place a digit when a cell has only one remaining candidate.',
  'Place a digit when it has only one possible cell in a row, column or box.',
  'When a box confines a digit to one row or column, remove it from the rest of that line.',
  'When a row or column confines a digit to one box, remove it from the rest of that box.',
  'Two cells sharing the same two candidates reserve those digits in their shared unit.',
  'Two digits restricted to the same two cells let you remove other candidates from those cells.',
  'Three cells with only three candidates between them reserve those digits in their unit.',
  'Three digits restricted to three cells let you remove other candidates from those cells.',
  'Four cells with only four candidates between them reserve those digits in their unit.',
  'Two rows restricting a digit to the same two columns eliminate that digit elsewhere in those columns, or vice versa.',
  'Four digits restricted to four cells let you remove other candidates from those cells.',
  'A three-line fish: three rows restrict a digit to three columns, or vice versa.',
  'A four-line fish: four rows restrict a digit to four columns, or vice versa.',
  'Combine a digit’s row-and-column arrangement inside a box with a strong link to eliminate a candidate.',
  'A chain of cells sharing the same pair alternates values, eliminating both digits from cells that see opposite ends.',
  'Two cells with the same candidate pair use a connecting strong link to eliminate one of those digits.',
  'A two-candidate pivot sees two pincers; their shared candidate can be removed from cells that see both pincers.',
  'A three-candidate pivot and two related pincers eliminate a shared digit from cells seeing all three.',
  'Search candidate branches by backtracking to find a solution when logical techniques cannot proceed.',
];
document.querySelector('#app')!.innerHTML = `${header}
<main class="techniques-page"><a class="back-link" href="./">← Back to generator</a>
<h1>Solving toolkit</h1><p class="toolkit-intro">20 imported Sudoku techniques, Phistomefel Ring, and cage deductions are available in the solver.</p>
<ol class="technique-cards">${TECHNIQUES.map((technique, i) => `<li><span class="technique-number">${String(i + 1).padStart(2, '0')}</span><h2>${technique.name}</h2><p>${descriptions[i]}</p></li>`).join('')}</ol>
<section class="techniques"><h2>Phistomefel Ring · 200 per use</h2><p>The 16 cells surrounding the central 3×3 box (R3C3–R3C7, R4C3, R4C7, R5C3, R5C7, R6C3, R6C7, R7C3–R7C7) contain the same digit tally as the four 2×2 corner blocks (rows 1–2 and 8–9, columns 1–2 and 8–9). Repeated digits count separately.</p><p>For each digit, the solver compares guaranteed occurrences with the remaining possible positions on both sides. Once the shared count reaches a limit, it removes extra candidates or fills all required positions. The walkthrough highlights both regions and explains the counts. This works with sum, product, mixed and Psycho cages, including cells outside cages.</p></section>
</main>${footer}`;
setupAbout();
