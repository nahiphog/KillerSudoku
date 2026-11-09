import { alternatingLinks, type ChainLink, type Step } from '../vendor/sudokui/steps';

/** Preserve the finder's logical links; XY-Wing supplies a pivot/pincer pattern instead. */
export function deductionLinks(step: Step): ChainLink[] {
  let links = step.links ?? [];
  if (step.tech === 'XY_WING' && step.primary?.length === 4 && step.secondary?.length === 2) {
    const [px, py, wx, wy] = step.primary;
    const [wz, vz] = step.secondary;
    links = alternatingLinks([wz, wx, px, py, wy, vz].map(candidate => [candidate]));
  }
  if (step.tech === 'XY_WING' || step.tech === 'W_WING') {
    const ends = step.tech === 'XY_WING' ? step.secondary ?? [] : step.primary ?? [];
    links = [...links, ...step.eliminations.flatMap(target => ends
      .filter(end => end.digit === target.digit)
      .map(end => ({ from: [end], to: [target], strong: false })))];
  }
  return links;
}
