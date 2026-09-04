import { describe } from '@pkgs/ui-testing';

import { setupFriendsPair } from '../fixtures/setup-friends-pair';
import { openSim } from '../setup/open-sim';

describe('friends request → accept', (ctx) => {
  ctx.test(
    'alice sends request; bob accepts from notifications; both see friends',
    async () => {
      await using sim = await openSim('friends-request-accept', ctx);
      await setupFriendsPair(sim);
    }
  );
});
