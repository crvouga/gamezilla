import type { ConsistencyStatus } from './types';

export const NS = 'http://www.w3.org/2000/svg';
export const STEP_MS = 600;

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
  '#4f8ff5', '#f59e42', '#3ddc84', '#e5484d', '#9b8afb',
  '#36c5a0', '#e8b931', '#f472b6', '#67e8f9', '#a78bfa',
];

export function nodeColor(allIds: string[], id: string): string {
  const i = allIds.indexOf(id);
  return NODE_COLORS[i >= 0 ? i % NODE_COLORS.length : 0];
}

export const STATUS_MAP: Record<
  ConsistencyStatus,
  { label: string; color: string; dot: string }
> = {
  idle:         { label: 'Idle',            color: C.text,   dot: C.text   },
  consistent:   { label: 'Consistent',      color: C.green,  dot: C.green  },
  inconsistent: { label: 'Inconsistent',    color: C.red,    dot: C.red    },
  syncing:      { label: 'Syncing\u2026',   color: C.yellow, dot: C.yellow },
  partitioned:  { label: 'All partitioned', color: C.red,    dot: C.dimRed },
};
