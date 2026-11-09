import { cellName } from './vendor/sudokui/board';
import type { ChainLink, CellDigit } from './vendor/sudokui/steps';

const ns = 'http://www.w3.org/2000/svg';
export function drawWalkthroughLinks(frame: HTMLElement, links: ChainLink[]) {
  frame.querySelector('.candidate-links')?.remove();
  if (!links.length) return;
  const bounds = frame.getBoundingClientRect();
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('candidate-links');
  svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Deduction links: solid means at least one endpoint is true; dashed means the endpoints cannot both be true.');
  const point = (candidate: CellDigit) => {
    const node = frame.querySelector<HTMLElement>(`[data-cell="${candidate.cell}"][data-digit="${candidate.digit}"]`);
    if (!node?.textContent) return null;
    const box = node.getBoundingClientRect();
    return { x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top };
  };
  for (const link of links) {
    // The supported wing/pair techniques use individual candidate endpoints.
    // Grouped endpoints, when supplied by another finder, join at their centroid.
    const center = (group: CellDigit[]) => {
      const points = group.map(point);
      if (points.some(p => !p)) return null;
      return { x: points.reduce((sum, p) => sum + p!.x, 0) / points.length, y: points.reduce((sum, p) => sum + p!.y, 0) / points.length };
    };
    const a = center(link.from), b = center(link.to);
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1) continue;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
    const inset = Math.min(5, length / 4);
    const bend = Math.min(12, length / 8);
    const d = `M ${a.x + ux * inset} ${a.y + uy * inset} Q ${(a.x + b.x) / 2 - uy * bend} ${(a.y + b.y) / 2 + ux * bend} ${b.x - ux * inset} ${b.y - uy * inset}`;
    const group = document.createElementNS(ns, 'g');
    const title = document.createElementNS(ns, 'title');
    const name = (items: CellDigit[]) => items.map(item => `${item.digit} at ${cellName(item.cell)}`).join(' / ');
    title.textContent = `${link.strong ? 'Strong' : 'Weak'} link: ${name(link.from)} — ${name(link.to)}.${link.text ? ' ' + link.text : ''}`;
    group.append(title);
    for (const style of ['link-halo', link.strong ? 'strong-link' : 'weak-link']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d); path.setAttribute('class', style); group.append(path);
    }
    svg.append(group);
  }
  frame.append(svg);
}
