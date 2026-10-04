import { parseChessBoardPaint } from '@pkgs/chess-board-core-shared/probe';

export function readAnnotationDom(host: HTMLElement) {
  const arrows = [
    ...host.querySelectorAll<SVGGElement>(
      '[data-testid="example-board-layer-arrows"] g'
    ),
  ].flatMap((g) => {
    const token = parseChessBoardPaint(g.textContent)[0];
    if (token === undefined) return [];
    const shaft = g.querySelector('path');
    return [
      {
        token,
        color: shaft?.getAttribute('stroke'),
        dashed: shaft?.hasAttribute('stroke-dasharray') ?? false,
        opacity: Number(g.getAttribute('opacity')),
      },
    ];
  });
  const highlights = [
    ...host.querySelectorAll<HTMLElement>(
      '[data-testid="example-board-layer-squares"] div'
    ),
  ].flatMap((el) => {
    const token = parseChessBoardPaint(el.textContent)[0];
    return token?.startsWith('highlight')
      ? [{ token, color: el.style.backgroundColor, ring: el.style.boxShadow }]
      : [];
  });
  const badges = [
    ...host.querySelectorAll<SVGGElement>(
      '[data-testid="example-board-layer-feedback"] g'
    ),
  ].map((el) => ({
    token: parseChessBoardPaint(el.textContent)[0],
    name: [...el.querySelectorAll('text')]
      .filter((text) => !text.textContent.includes('⟦'))
      .map((text) => text.textContent)
      .join(''),
    accessibleName: el.getAttribute('aria-label'),
  }));
  return { arrows, highlights, badges };
}
