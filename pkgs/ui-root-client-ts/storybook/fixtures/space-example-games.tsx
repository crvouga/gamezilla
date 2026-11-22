import type { SpaceGame, SpaceRole } from '../../src/space-types';
import { spaceExampleBattleship } from './space-example-battleship';
import { spaceExampleChessSetup } from './space-example-chess';
import { heartsSpaceExample } from './space-example-hearts';
import { spaceExampleLightCycles } from './space-example-light-cycles';
import { spaceExampleWordTiles } from './space-example-word-tiles';

/** The reference games every space template is checked against. */
export type SpaceExampleGameKey =
  | 'lightCycles'
  | 'chess'
  | 'hearts'
  | 'battleship'
  | 'wordTiles';

/** The games whose board `@pkgs/ui` draws (Chess's lives in its own package). */
export type SpaceExamplePlayKey = Exclude<SpaceExampleGameKey, 'chess'>;

export const SPACE_EXAMPLE_GAME_KEYS: readonly SpaceExampleGameKey[] = [
  'lightCycles',
  'chess',
  'hearts',
  'battleship',
  'wordTiles',
];

export const SPACE_EXAMPLE_PLAY_KEYS: readonly SpaceExamplePlayKey[] = [
  'lightCycles',
  'hearts',
  'battleship',
  'wordTiles',
];

/** Bots seated by each game in the stories: Hearts fills two seats. */
export function spaceExampleBots(key: SpaceExampleGameKey): number {
  return key === 'hearts' ? 2 : 0;
}

/**
 * One reference game as a `SpaceGame`, seen by `role`. Builds signals and
 * boards, so call it inside a render.
 */
export function spaceExampleGame(
  key: SpaceExampleGameKey,
  role: SpaceRole,
  onAction: (id: string) => void
): SpaceGame {
  if (key === 'chess') return spaceExampleChessSetup();
  if (key === 'hearts') return heartsSpaceExample({ viewer: role, onAction });
  if (key === 'battleship') return spaceExampleBattleship({ role, onAction });
  if (key === 'wordTiles') return spaceExampleWordTiles({ role, onAction });
  return spaceExampleLightCycles({ role, onAction });
}
