import type { ReadGameRecord } from '@libs/game-session-harness-ts/harness-game';

/** Independent reader of the exported Pong record, with no invented turn history. */
export function readPongRecord(record: string): Omit<ReadGameRecord, 'moves'> {
  const value: unknown = JSON.parse(record);
  if (
    value === null ||
    typeof value !== 'object' ||
    !('game' in value) ||
    value.game !== 'pong'
  )
    throw new Error('not a Pong game record');
  const data = value as Record<string, unknown>;
  const participants = data['participants'];
  const name = (index: number): string | null => {
    const person: unknown = Array.isArray(participants)
      ? participants[index]
      : null;
    return person !== null &&
      typeof person === 'object' &&
      'name' in person &&
      typeof person.name === 'string'
      ? person.name
      : null;
  };
  const outcome = data['outcome'];
  return {
    firstSide: name(0),
    secondSide: name(1),
    result:
      outcome === 'white' || outcome === 'black' || outcome === 'draw'
        ? outcome
        : null,
    clockChoice: null,
  };
}
