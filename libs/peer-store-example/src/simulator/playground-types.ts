export const TRUST_MAP = {
  'player-x': 1,
  'player-o': 1,
  server: 3,
  observer: 1,
} as const;

export type PeerId = keyof typeof TRUST_MAP;

export const PEERS: PeerId[] = ['player-x', 'player-o', 'server', 'observer'];

export type LogEntry = {
  id: number;
  kind: 'action' | 'effect' | 'cheat';
  tag: string;
  summary: string;
  code?: string | undefined;
  peerId?: string | undefined;
  detected?: boolean | undefined;
};

export type CheatLogEntry = {
  id: number;
  detected: boolean;
  peerId?: string | undefined;
  scenario: string;
  detail: string;
};

export type MessageLogEntry = {
  id: number;
  from: string;
  kind: string;
  summary: string;
};
