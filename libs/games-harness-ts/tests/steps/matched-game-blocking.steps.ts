/**
 * A block between two people seeking an opponent, before they are paired
 * or after: blocking itself is the Friends context's.
 */

import {
  blockPerson,
  openPersonFromSearch,
} from '@libs/friends-harness-ts/person-actions';
import { prepareNamedFriend } from '@libs/friends-harness-ts/setup-friend-request';
import { Given } from '@libs/harness-ts/define';
import { pairedAt } from './matched-game';

Given(
  '{actor} blocked {actor} after they were paired',
  async (w, actor: string, blocked: string) => {
    await pairedAt(w, actor, blocked);
    await prepareNamedFriend(w.s, actor);
    await prepareNamedFriend(w.s, blocked);
    await w.s.apply(openPersonFromSearch, actor, blocked);
    await w.s.apply(blockPerson, actor, blocked);
  }
);
