/**
 * Private setups, in a custom game and in a matched game alike: having one
 * complete or not, changing it, and who can see it — each person their own,
 * nobody anyone else's, read on their screen and in what reaches their
 * device.
 */

import { expect } from 'bun:test';
import { inMatchedGame } from '@libs/game-matchmaking-harness/matched-game-world';
import { shownBoardPosition } from '@libs/game-matchmaking-harness/multiplayer-review';
import {
  anotherCompleteSetup,
  changeCustomGamePrivateSetup,
  customGamePrivateSetupShown,
} from '@libs/game-session-harness/custom-game-private-setup';
import { readCustomGameScreen } from '@libs/game-session-harness/custom-game-screen';
import {
  gameHistoryReviewPosition,
  openGameHistoryRecord,
} from '@libs/game-session-harness/game-history-review';
import {
  changeMatchedPrivateSetup,
  matchedSideReadinessShown,
  ownMatchedPrivateSetup,
  showMatchedGame,
} from '@libs/game-session-harness/matched-game-private-setup';
import { privateSetupsReaching } from '@libs/game-session-harness/private-setup-reach';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { gameOf } from './game-world';
import {
  arrangeKnownSetup,
  INCOMPLETE,
  knownSetups,
  leaveSetupIncomplete,
  opposingSetups,
  rememberSetup,
  revealedAfter,
  setupOf,
  setupStatusOf,
  sideOfPerson,
} from './private-setup-world';

const BEFORE_CHANGE = 'private-setup:before-change';

/** The private setup `actor`'s own screen shows them, as one value. */
async function ownShown(w: HarnessWorld, actor: string) {
  if (inMatchedGame(w)) return w.s.read(ownMatchedPrivateSetup, actor);
  return w.s.read(customGamePrivateSetupShown, actor);
}

/** `viewer` sees none of `hidden` on their screen, and none reaches their device. */
async function seesNone(
  w: HarnessWorld,
  viewer: string,
  hidden: readonly string[]
) {
  if (!inMatchedGame(w)) {
    const shown = await w.s.read(customGamePrivateSetupShown, viewer);
    for (const setup of hidden) {
      expect(shown.own).not.toBe(setup);
      expect(shown.arranged).not.toBe(setup);
    }
  } else
    for (const setup of hidden)
      expect(await w.s.read(ownMatchedPrivateSetup, viewer)).not.toBe(setup);
  expect(await w.s.read(privateSetupsReaching, viewer, hidden)).toEqual([]);
}

Given('{actor} has a complete private setup', async (w, actor: string) =>
  arrangeKnownSetup(w, actor)
);
Given("{actor}'s private setup is incomplete", async (w, actor: string) =>
  leaveSetupIncomplete(w, actor)
);

// The change is to a complete setup other than every one the game knows.
When('{actor} changes his/her private setup', async (w, actor: string) => {
  w.memo.set(BEFORE_CHANGE, await ownShown(w, actor));
  const setup = anotherCompleteSetup(gameOf(w), [
    await setupOf(w, actor),
    ...Object.values(knownSetups(w)),
  ]);
  w.memo.set('private-setup:change', setup);
  await w.s.apply(
    inMatchedGame(w) ? changeMatchedPrivateSetup : changeCustomGamePrivateSetup,
    actor,
    setup
  );
  rememberSetup(w, actor, setup);
});

Then(
  '{actor} is told his/her private setup is incomplete',
  async (w, actor: string) => {
    expect(await setupStatusOf(w, actor)).toBe(INCOMPLETE);
  }
);
Then("{actor}'s private setup is unchanged", async (w, actor: string) => {
  expect(await ownShown(w, actor)).toEqual(
    w.memo.get(BEFORE_CHANGE) as Awaited<ReturnType<typeof ownShown>>
  );
});
Then(
  "{actor} and {actor} cannot see {actor}'s private setup",
  async (w, first: string, second: string, owner: string) => {
    const hidden = [await setupOf(w, owner)];
    await seesNone(w, first, hidden);
    await seesNone(w, second, hidden);
  }
);
Then('{actor} cannot see either private setup', async (w, viewer: string) => {
  await seesNone(w, viewer, Object.values(knownSetups(w)));
});
Then(
  "{actor} cannot see the rest of {actor}'s private setup",
  async (w, viewer: string, owner: string) => {
    await seesNone(w, viewer, [await setupOf(w, owner)]);
  }
);
// Her own setup reaches her and the other's does not; play revealed the
// position after her first move, which the board in front of her shows.
Then(
  "{actor} sees her own private setup and what play revealed of {actor}'s",
  async (w, actor: string, other: string) => {
    const [own, hidden] = await opposingSetups(w, actor, other);
    expect(await w.s.read(privateSetupsReaching, actor, [own, hidden])).toEqual(
      [own]
    );
    if (inMatchedGame(w)) {
      expect(await w.s.read(ownMatchedPrivateSetup, actor)).toBe(own);
      expect(await w.s.read(shownBoardPosition, actor)).toBe(
        revealedAfter(w, 1)
      );
      return;
    }
    await w.s.apply(openGameHistoryRecord, actor);
    expect(await w.s.read(gameHistoryReviewPosition, actor)).toBe(
      revealedAfter(w, 1)
    );
  }
);

/** `viewer`'s screen shows `person` ready. */
async function seesReady(w: HarnessWorld, viewer: string, person: string) {
  const side = await sideOfPerson(w, person);
  if (inMatchedGame(w)) {
    await w.s.apply(showMatchedGame, viewer);
    await w.s.until((s) => matchedSideReadinessShown(s, viewer, side), {
      pred: (ready) => ready === true,
    });
    return;
  }
  await w.s.until((s) => readCustomGameScreen(s, viewer), {
    pred: (screen) => screen?.current?.ready.includes(side) === true,
  });
}

Then(
  '{actor} and {actor} see {actor} is ready',
  async (w, first: string, second: string, person: string) => {
    await seesReady(w, first, person);
    await seesReady(w, second, person);
  }
);
