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
<h1>Solving toolkit</h1><p class="toolkit-intro">20 techniques in the repertoire. These standard Sudoku techniques are imported and available in the engine for the next stage of the solver.</p>
<ol class="technique-cards">${TECHNIQUES.map((technique, i) => `<li><span class="technique-number">${String(i + 1).padStart(2, '0')}</span><h2>${technique.name}</h2><p>${descriptions[i]}</p></li>`).join('')}</ol>
</main>${footer}`;
setupAbout();
