import { expect, test } from 'bun:test';
import { openCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { readCustomGameIdentity } from '@libs/chess-custom-game-harness/custom-game-identity';
import { readCustomGameName } from '@libs/chess-custom-game-harness/custom-game-names';
import { readCustomGameInvitation } from '@libs/chess-custom-game-harness/custom-game-play-reads';
import { configureCustomGameChoice } from '@libs/game-session-harness/custom-game-ui';
import { createSpace, joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { openHarness } from './open-chess-harness';

// regression: custom-game-member-names-unsynced
test('a guest invited from the link sees the host’s name on the invitation', async () => {
  await using s = await openHarness('custom-game-member-names');
  await s.apply(createSpace, 'alice');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('alice has no space link');
  await s.apply(joinViaLink, 'bob', link);
  await s.apply(openCustomGame, 'alice');
  await s.apply(openCustomGame, 'bob');
  await s.apply(configureCustomGameChoice, 'alice', { operation: 'create' });
  const host = await s.read(readCustomGameName, 'alice', 'white');
  expect(host).toBeTruthy();
  await s.apply(configureCustomGameChoice, 'alice', {
    operation: 'invite',
    side: 'black',
    person: await s.read(readCustomGameIdentity, 'bob'),
  });
  const invitation = await s.until(
    (world) => readCustomGameInvitation(world, 'bob', 'black'),
    { pred: (text) => text !== null && text.includes(String(host)) }
  );
  expect(invitation).toBe(`${host} invites you to play Black.`);
}, 120_000);
