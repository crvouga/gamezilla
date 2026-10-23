/**
 * An invitation names who sent it, for every game offering custom games:
 * a guest who joined from the space's link sees the host's name on it, the
 * name the host's own seat shows.
 */

import { expect, test } from 'bun:test';
import { readCustomGameIdentity } from '@libs/game-session-harness-ts/custom-game-identity';
import { readCustomGameName } from '@libs/game-session-harness-ts/custom-game-names';
import { readCustomGameInvitation } from '@libs/game-session-harness-ts/custom-game-reads';
import { configureCustomGameChoice } from '@libs/game-session-harness-ts/custom-game-ui';
import { openCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  // regression: custom-game-member-names-unsynced
  test('a guest invited from the link sees the host’s name on the invitation', async () => {
    await using s = await openConformanceHarness(
      `${game.shared.id}-custom-game-member-names`
    );
    await s.apply(createSpace, 'alice');
    const link = await s.read(readSpaceLink, 'alice');
    if (link === null) throw new Error('alice has no space link');
    await s.apply(joinViaLink, 'bob', link);
    await s.apply(openCustomGames, 'alice', game.shared.id);
    await s.apply(openCustomGames, 'bob', game.shared.id);
    await s.apply(configureCustomGameChoice, 'alice', {
      operation: 'create',
      game: game.shared.id,
    });
    await s.apply(configureCustomGameChoice, 'alice', {
      operation: 'take',
      side: 'white',
    });
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
    expect(invitation).toContain(String(host));
  }, 120_000);
});
