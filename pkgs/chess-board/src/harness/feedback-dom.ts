import { parseChessBoardPaint } from '@pkgs/chess-board-core/probe';
import { appearanceColor } from './annotation-appearance';
import type { BoardWorld } from './board-world';

function paintedSymbol(group: SVGGElement) {
  const text = [...group.querySelectorAll('text')]
    .filter((el) => !el.textContent.includes('⟦'))
    .map((el) => el.textContent)
    .join('');
  const path = group.querySelector('path')?.getAttribute('d');
  if (path === 'M18 54 L42 78 L84 26') return 'tick';
  if (path === 'M22 22 L78 78 M78 22 L22 78') return 'cross';
  if (text === '!!') return 'exclamations';
  return text.length > 0 ? text : 'unrecognized';
}
function badgePlacement(host: HTMLElement, group: SVGGElement, square: string) {
  const hit = host.querySelector<HTMLElement>(`[data-square="${square}"]`);
  const cell = hit?.style.transform.match(
    /translate\(([\d.]+)cqw,\s*([\d.]+)cqw\)/
  );
  const badge = group
    .getAttribute('transform')
    ?.match(/translate\(([\d.]+)[ ,]+([\d.]+)\)/);
  const viewBox = group.ownerSVGElement
    ?.getAttribute('viewBox')
    ?.split(/\s+/)
    .map(Number);
  if (
    cell === null ||
    cell === undefined ||
    badge === null ||
    badge === undefined ||
    viewBox?.[2] === undefined
  )
    return 'unrecognized';
  const x = (Number(badge[1]) / viewBox[2] - Number(cell[1]) / 100) * 8;
  const y = (Number(badge[2]) / viewBox[2] - Number(cell[2]) / 100) * 8;
  if (Math.abs(x - 0.5) < 0.001 && Math.abs(y - 0.5) < 0.001) return 'center';
  if (x > 0.5 && x < 1 && y > 0 && y < 0.5) return 'upper-right';
  return 'unrecognized';
}
export function readFeedbackAppearance(w: BoardWorld) {
  return [
    ...w.app.host.querySelectorAll<SVGGElement>(
      '[data-testid="example-board-layer-feedback"] g'
    ),
  ]
    .filter((g) =>
      parseChessBoardPaint(g.textContent)[0]?.startsWith('feedback:')
    )
    .map((g) => {
      const token = parseChessBoardPaint(g.textContent)[0];
      const square = token?.split('@')[1] ?? 'unrecognized';
      return {
        square,
        symbol: paintedSymbol(g),
        color: appearanceColor(
          g.querySelector('circle')?.getAttribute('fill') ?? null
        ),
        placement: badgePlacement(w.app.host, g, square),
        path: g.querySelector('path')?.getAttribute('d') ?? null,
        opacity: Number(g.getAttribute('opacity')),
      };
    });
}
export const readFeedbackAt = (w: BoardWorld, square: string) => {
  const m = readFeedbackAppearance(w).find((mark) => mark.square === square);
  return m === undefined
    ? null
    : {
        ...m,
        descriptor: `${m.color} ${m.symbol}`,
        visible: m.opacity > 0 && m.opacity <= 1,
      };
};
