/**
 * An invitation names who sent it, for every game offering game sessions:
 * a guest who joined from the space's link sees the host's name on it, the
 * name the host's own seat shows.
 */

import { expect, test } from 'bun:test';
import { openGameSessions } from '@libs/game-session-harness-ts/game-navigation';
import { readGameSessionIdentity } from '@libs/game-session-harness-ts/game-session-identity';
import { readGameSessionName } from '@libs/game-session-harness-ts/game-session-names';
import { readGameSessionInvitation } from '@libs/game-session-harness-ts/game-session-reads';
import { configureGameSessionChoice } from '@libs/game-session-harness-ts/game-session-ui';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

forEveryGame(
  import.meta.path,
  (game) => {
    // regression: game-session-member-names-unsynced
    test('a guest invited from the link sees the host’s name on the invitation', async () => {
      await using s = await openConformanceHarness();
      await s.apply(createSpace, 'alice');
      const link = await s.read(readSpaceLink, 'alice');
      if (link === null) throw new Error('alice has no space link');
      await s.apply(joinViaLink, 'bob', link);
      await s.apply(openGameSessions, 'alice', game.shared.id);
      await s.apply(openGameSessions, 'bob', game.shared.id);
      await s.apply(configureGameSessionChoice, 'alice', {
        operation: 'create',
        mode: 'vs-human',
        game: game.shared.id,
      });
      const host = await s.read(readGameSessionName, 'alice', 'white');
      expect(host).toBeTruthy();
      await s.apply(configureGameSessionChoice, 'alice', {
        operation: 'invite',
        side: 'black',
        person: await s.read(readGameSessionIdentity, 'bob'),
      });
      const invitation = await s.until(
        (world) => readGameSessionInvitation(world, 'bob', 'black'),
        { pred: (text) => text !== null && text.includes(String(host)) }
      );
      expect(invitation).toContain(String(host));
    }, 120_000);
  },
  ['two seats']
);
