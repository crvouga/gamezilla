/** Draw a laid-out graph of cards as one inline SVG. */

import type { LayoutEdge } from './infra-layout';
import { layoutLayered } from './infra-layout';
import { logoSvg } from './infra-render-logo';
import { esc, truncate } from './infra-render-text';

export type Card = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** The first logo is the card's identity; the rest are chips. */
  readonly logos: readonly string[];
  readonly href: string | null;
  readonly tone: 'managed' | 'data' | 'external';
  readonly stateful: boolean;
  readonly tooltip: string;
};

export type GraphSize = 'overview' | 'detail';

const SIZES: Readonly<
  Record<
    GraphSize,
    { width: number; height: number; gapX: number; gapY: number }
  >
> = {
  overview: { width: 284, height: 66, gapX: 72, gapY: 20 },
  detail: { width: 264, height: 56, gapX: 64, gapY: 14 },
};

const CHIP = 16;

function cardSvg(card: Card, x: number, y: number, size: GraphSize): string {
  const { width, height } = SIZES[size];
  const tile = height - 20;
  const extras = card.logos.slice(1, 4);
  const reserve = extras.length * (CHIP + 4);
  const textX = x + tile + 20;
  const room = Math.floor((width - tile - 32 - reserve) / 6.7);
  const chips = extras
    .map((id, i) =>
      logoSvg(id, x + width - 10 - (i + 1) * (CHIP + 4) + 4, y + 8, CHIP)
    )
    .join('');
  const classes = `card ${card.tone}${card.stateful ? ' stateful' : ''}`;
  const body = `<g class="${classes}"><title>${esc(card.tooltip)}</title>
<rect class="card-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="10"/>
<rect class="card-tile" x="${x + 10}" y="${y + 10}" width="${tile}" height="${tile}" rx="8"/>
${logoSvg(card.logos[0] ?? 'opentofu', x + 10 + (tile - tile * 0.64) / 2, y + 10 + (tile - tile * 0.64) / 2, tile * 0.64)}
<text class="card-title" x="${textX}" y="${y + height / 2 - 3}">${esc(truncate(card.title, room))}</text>
<text class="card-sub" x="${textX}" y="${y + height / 2 + 14}">${esc(truncate(card.subtitle, Math.floor(room * 1.12)))}</text>
${chips}</g>`;
  return card.href === null ? body : `<a href="${esc(card.href)}">${body}</a>`;
}

export function renderGraph(
  graphId: string,
  cards: readonly Card[],
  edges: readonly LayoutEdge[],
  size: GraphSize
): string {
  const dims = SIZES[size];
  const layout = layoutLayered(
    cards.map((c) => ({ id: c.id, width: dims.width, height: dims.height })),
    edges,
    { gapX: dims.gapX, gapY: dims.gapY, pad: 14 }
  );
  if (layout.nodes.length === 0) return '';
  const byId = new Map(cards.map((c) => [c.id, c]));
  const marker = `arrow-${graphId}`;
  const routes = layout.routes
    .map(
      (r) =>
        `<path class="edge${r.back ? ' back' : ''}" d="${r.path}" marker-end="url(#${marker})"/>`
    )
    .join('');
  const nodes = layout.nodes
    .map((n) => {
      const card = byId.get(n.id) as Card;
      return cardSvg(card, n.x, n.y, size);
    })
    .join('');
  const label = cards.map((c) => c.title).join(', ');
  return `<div class="graph-scroll"><svg class="graph" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="img" aria-label="${esc(label)}">
<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow"/></marker></defs>
<g class="edges">${routes}</g><g class="cards">${nodes}</g></svg></div>`;
}
