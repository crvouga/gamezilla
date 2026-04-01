import { assert } from '@gamezilla/shared/assert';

export const NS = 'http://www.w3.org/2000/svg';

/** Core neutrals + accents for the playground graph and chrome. */
export const C = {
  bg: '#0a0a0a',
  node: '#161616',
  nodeBorder: '#333',
  nodeSelBg: '#1a1a30',
  nodeSelBorder: '#4f6df5',
  text: '#999',
  textLight: '#ccc',
  textDim: '#555',
  edge: '#3a3a3a',
  edgeBroken: '#222',
  blue: '#4f8ff5',
  green: '#3ddc84',
  orange: '#f59e42',
  red: '#e5484d',
  violet: '#9b8afb',
  teal: '#36c5a0',
  yellow: '#e8b931',
  dimRed: '#5c2024',
};

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
