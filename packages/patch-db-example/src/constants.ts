import { assert } from '@gamezilla/assert';

const NODE_COLORS = [
  '#4f8ff5',
  '#f59e42',
  '#3ddc84',
  '#e5484d',
  '#9b8afb',
  '#36c5a0',
  '#e8b931',
  '#f472b6',
  '#67e8f9',
  '#a78bfa',
];

export const SERVER_NODE_ID = '__server__';

export function nodeColor(allIds: string[], id: string): string {
  const i = allIds.indexOf(id);
  const idx = i >= 0 ? i % NODE_COLORS.length : 0;
  const fromIdx = NODE_COLORS[idx];
  const fallback = NODE_COLORS[0];
  assert.defined(fallback, 'nodeColor: palette must be non-empty');
  return fromIdx ?? fallback;
}
