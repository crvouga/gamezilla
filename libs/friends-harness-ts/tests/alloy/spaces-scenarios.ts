/**
 * The one scripted spaces run: what the space-hosting model cannot draw, as
 * its two people are friends. A guest hosts a space; another guest, no
 * friend of theirs, does not find it in their lobby; they join it from its
 * link — after which the product lists it in their lobby, which the
 * structure does not allow (`LobbyListsOwnAndFriendsOpenSpaces`).
 */

import { focusActor } from '@libs/harness-ts/shell-actions';
import type { Scenario } from '@libs/harness-ts/snapshot-worlds';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';

export const SPACES_SCENARIO: Scenario = {
  name: 'a guest joins the space of another guest from its link',
  run: async (s, capture) => {
    await s.apply(focusActor, 'alice');
    await s.apply(createSpace, 'alice');
    const link = await s.read(readSpaceLink, 'alice');
    if (link === null) throw new Error('alice opened no space');
    await s.apply(focusActor, 'bob');
    await capture('Alice hosts a space Bob is no friend of');
    await s.apply(joinViaLink, 'bob', link);
  },
};
