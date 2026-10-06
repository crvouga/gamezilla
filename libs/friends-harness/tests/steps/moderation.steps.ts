/**
 * Moderation steps for the inbox: a friend request names its asker as
 * everyone sees them, a stand-in name once their username is no longer
 * allowed.
 */

import { friendRequestCardText } from '@libs/friends-harness/friends-ui-reads';
import { rememberedUsername } from '@libs/friends-harness/remembered-username';
import { Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { recall } from '@libs/harness/spec-world';
import { standInNameOf } from '@libs/profile-harness/profile-ui-reads';

const SECOND_MS = 1_000;
const ASKER = 'moderation:asker';

Then(
  "{actor}'s inbox shows a friend request from {actor}'s stand-in name within {int} seconds",
  async (w, actor: Actor, from: Actor, seconds: number) => {
    const standIn = await w.s.read(standInNameOf, from);
    if (standIn === null) throw new Error(`${from} has no profile yet`);
    const card = rememberedUsername(w, from);
    w.memo.set(ASKER, card);
    await w.s.until((surf) => friendRequestCardText(surf, actor, card), {
      pred: (text) => text?.includes(standIn) === true,
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s inbox does not show {username}",
  async (w, actor: Actor, username: string) => {
    const card = String(recall(w, ASKER));
    await w.s.until((surf) => friendRequestCardText(surf, actor, card), {
      pred: (text) => text !== null && !text.includes(username),
    });
  }
);
