import { expect, test } from 'bun:test';
import { QUORIDOR_HILL_PLAYABLE } from '@libs/quoridor-harness-ts/quoridor-playable';
import { completeCustomGameParty } from '@libs/runtime-harness-ts/custom-game-party-journey';
import { delayedPartyHost } from './custom-game-party-fixture';

// regression: party-journey-optimistic-ply-accepted
test('party acceptance reports both devices when optimistic move 17 rolls back to recorded Hill ply 16', async () => {
  // Observed input: peer waiting for 17 at this exact authoritative position.
  // The provisional g6 and attempted f5 model a possible cause; neither was captured in the failure trace.
  const fixture = delayedPartyHost('rollback');
  let failure: unknown;
  try {
    await completeCustomGameParty(fixture.host, QUORIDOR_HILL_PLAYABLE);
  } catch (cause) {
    failure = cause;
  }
  expect(fixture.rejected()).toBe(true);
  expect(fixture.players).toHaveLength(9);
  expect(fixture.players.at(-1)).toBe('white');
  expect(fixture.moves.join(',')).toBe(
    'e2,b5,e8,h5,e3,c5,e7,g5,e4,d4h,e5v,c5v,f4,c6,e6,f5'
  );
  expect(failure).toBeInstanceOf(Error);
  const error = failure as Error;
  expect(error.message).toContain('Party acceptance 17');
  expect(error.message).toContain('action f5');
  expect(error.message).toContain('That move is not legal in this position.');
  expect(error.message).toContain(
    'quoridor:1:hill:e2,b5,e8,h5,e3,c5,e7,g5,e4,d4h,e5v,c5v,f4,c6,e6,f5'
  );
  expect(error.message).toContain('"host"');
  expect(error.message).toContain('"peer"');
  expect(error.cause).toBeInstanceOf(Error);
});
