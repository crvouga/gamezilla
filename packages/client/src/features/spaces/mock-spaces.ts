import type { Space, SpaceFilter } from './types';

export const MOCK_SPACES: readonly Space[] = [
  {
    id: 's1',
    title: 'Friday Night Trivia',
    gameType: 'trivia',
    listenerCount: 128,
    live: true,
    isHostedByMe: false,
    host: { id: 'h1', displayName: 'Alex' },
  },
  {
    id: 's2',
    title: 'Sketch & Guess',
    gameType: 'drawing',
    listenerCount: 42,
    live: true,
    isHostedByMe: true,
    host: { id: 'guest', displayName: 'You' },
  },
  {
    id: 's3',
    title: 'Word Blitz Lobby',
    gameType: 'word-guess',
    listenerCount: 0,
    live: false,
    isHostedByMe: false,
    host: { id: 'h2', displayName: 'Jordan' },
  },
  {
    id: 's4',
    title: 'Party Pack Warmup',
    gameType: 'party',
    listenerCount: 16,
    live: true,
    isHostedByMe: false,
    host: { id: 'h3', displayName: 'Sam' },
  },
  {
    id: 's5',
    title: 'My Co-op Room',
    gameType: 'trivia',
    listenerCount: 3,
    live: false,
    isHostedByMe: true,
    host: { id: 'guest', displayName: 'You' },
  },
  {
    id: 's6',
    title: 'Late Night Drawing',
    gameType: 'drawing',
    listenerCount: 89,
    live: true,
    isHostedByMe: false,
    host: { id: 'h4', displayName: 'Riley' },
  },
];

export function getSpaceById(id: string): Space | undefined {
  return MOCK_SPACES.find((s) => s.id === id);
}

export function filterSpaces(
  spaces: readonly Space[],
  filter: SpaceFilter,
): Space[] {
  if (filter === 'live') {
    return spaces.filter((s) => s.live);
  }
  if (filter === 'mine') {
    return spaces.filter((s) => s.isHostedByMe);
  }
  return [...spaces];
}
