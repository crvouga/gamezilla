/**
 * The day after a declined friend request: the asker can ask again.
 */

import { letTimePass } from '@libs/harness-ts/actions';
import { When } from '@libs/harness-ts/define';

const DAY_MS = 24 * 60 * 60 * 1000;

When('a day passes', async (w) => {
  await w.s.apply(letTimePass, DAY_MS);
});
