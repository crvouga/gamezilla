import { describe } from '@pkgs/ui-testing';

import { aliceUsername } from '../fixtures/fixtures';
import { setupFriendsPair } from '../fixtures/setup-friends-pair';
import { openSim } from '../setup/open-sim';

describe('space friend join', (ctx) => {
  ctx.test(
    'host creates; friend joins from lobby card',
    async () => {
      await using sim = await openSim('space-friend-join', ctx);
      const { alice, bob } = await setupFriendsPair(sim);

      await alice.space.createSpace();

      await bob.space.openTab();
      await bob.space.expectLobbyCard(aliceUsername);
      await bob.space.openLobbyCard(aliceUsername);
      await bob.space.joinFromPrompt();
      await bob.space.expectActiveSpace();
    },
    30_000
  );
});
