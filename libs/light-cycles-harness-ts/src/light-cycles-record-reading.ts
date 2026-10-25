import type { ReadGameRecord } from '@libs/game-session-harness-ts/harness-game';
import { GAME_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';

const MODES = ['light-cycles', 'light-cycles-3', 'light-cycles-4'];

/** Independent reader of an exported Light Cycles record, with no invented turn history. */
export function readLightCyclesRecord(
  record: string
): Omit<ReadGameRecord, 'moves'> {
  const value: unknown = JSON.parse(record);
  if (
    value === null ||
    typeof value !== 'object' ||
    !('game' in value) ||
    !MODES.includes(String(value.game))
  )
    throw new Error('not a Light Cycles game record');
  const data = value as Record<string, unknown>;
  const participants = Array.isArray(data['participants'])
    ? (data['participants'] as unknown[])
    : [];
  const names = participants.map((person) =>
    person !== null &&
    typeof person === 'object' &&
    'name' in person &&
    typeof person.name === 'string'
      ? person.name
      : ''
  );
  const outcome = data['outcome'];
  return {
    firstSide: names[0] ?? null,
    secondSide: names[1] ?? null,
    participants: names,
    result:
      outcome === 'draw' || (GAME_SIDES as readonly unknown[]).includes(outcome)
        ? (outcome as ReadGameRecord['result'])
        : null,
    clockChoice: null,
  };
}
