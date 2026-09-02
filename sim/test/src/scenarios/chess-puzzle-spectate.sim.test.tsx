import { describe } from '@pkgs/ui-testing';

import { aliceUsername } from '../fixtures/fixtures';
import { setupFriendsPair } from '../fixtures/setup-friends-pair';
import { openSim } from '../setup/open-sim';

describe('chess puzzle spectate', (ctx) => {
  ctx.test(
    'guest board probe tracks host; guest drag does not desync',
    async () => {
      await using sim = await openSim('chess-puzzle-spectate', ctx);
      const { alice, bob } = await setupFriendsPair(sim);

      await alice.space.createSpace();

      await bob.space.openTab();
      await bob.space.expectLobbyCard(aliceUsername);
      await bob.space.openLobbyCard(aliceUsername);
      await bob.space.joinFromPrompt();
      await bob.space.expectActiveSpace();

      // Multi-app RNTL mounts one actor — remount alice into the space.
      await alice.space.reenterActiveSpace(aliceUsername);
      await alice.chess.openPuzzleFromSpace();

      await bob.chess.resumePuzzlePlay(aliceUsername);
      await alice.chess.resumePuzzlePlay(aliceUsername);
      await alice.chess.playExpectedMove();

      await alice.chess.expectProbeMatchesPeer(bob.chess, aliceUsername);

      await bob.chess.resumePuzzlePlay(aliceUsername);
      await bob.chess.board.drag('a2', 'a3');
      await alice.chess.expectProbeMatchesPeer(bob.chess, aliceUsername);
    },
    90_000
  );
});
