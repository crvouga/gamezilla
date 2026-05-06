import { isPlainRecord } from '@gamezilla/lib/message';

export const SpaceGame = {
  chess: 'chess',
} as const;

export type SpaceGameDiscriminator = (typeof SpaceGame)[keyof typeof SpaceGame];
export type SelectedSpaceGame = SpaceGameDiscriminator | null;

const validSpaceGames = new Set<string>(Object.values(SpaceGame));

export function isSpaceGameDiscriminator(
  value: unknown
): value is SpaceGameDiscriminator {
  return typeof value === 'string' && validSpaceGames.has(value);
}

export function readSelectedSpaceGame(value: unknown): SelectedSpaceGame {
  return isSpaceGameDiscriminator(value) ? value : null;
}

export function validateSelectGamePayload(
  payload: unknown
): payload is { game: SelectedSpaceGame } {
  if (!isPlainRecord(payload)) return false;
  if (!('game' in payload)) return false;
  const game = payload['game'];
  return game === null || isSpaceGameDiscriminator(game);
}
