export type GameTypeId = 'trivia' | 'drawing' | 'word-guess' | 'party';

export type SpaceHost = {
  id: string;
  displayName: string;
};

export type Space = {
  id: string;
  title: string;
  gameType: GameTypeId;
  listenerCount: number;
  live: boolean;
  /** Current (guest) user is hosting this space */
  isHostedByMe: boolean;
  host: SpaceHost;
};

export type SpaceFilter = 'all' | 'live' | 'mine';
