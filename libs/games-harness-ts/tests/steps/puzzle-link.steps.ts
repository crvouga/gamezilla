/**
 * Puzzle links to puzzles of the run's game: sharing the link to the puzzle
 * on the board, and opening someone's link — that exact puzzle on the
 * board, in its game, rated only on a first attempt, or why it cannot open.
 */

import { expect } from 'bun:test';
import {
  isPuzzleLinkUnavailableVisible,
  openPuzzleLink,
  puzzleLinkTo,
  readSharedPuzzleLink,
  sharePuzzleLink,
} from '@libs/game-session-harness-ts/puzzle-link';
import { theKnownPuzzle } from '@libs/game-session-harness-ts/puzzle-moves';
import { hasPlayedPuzzle } from '@libs/game-session-harness-ts/puzzle-records';
import {
  isPuzzleAttemptRated,
  readPuzzleOnBoard,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf } from './game-world';
import {
  ensureOnPuzzle,
  focusPuzzle,
  required,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

const sharedLinkKey = (actor: Actor) => `puzzle-link:${actor}`;
const earlierLinkKey = (actor: Actor) => `puzzle-link-before:${actor}`;

/** Share the link to the puzzle on `actor`'s board; the link shared. */
async function share(w: HarnessWorld, actor: Actor): Promise<string> {
  await focusPuzzle(w, actor);
  await w.s.apply(sharePuzzleLink, actor);
  return required(
    await w.s.read(readSharedPuzzleLink, actor),
    `${actor}'s puzzle link`
  ).link;
}

function sharedLink(w: HarnessWorld, sharer: Actor): string {
  return required(
    w.memo.get(sharedLinkKey(sharer)) as string | undefined,
    `a puzzle link ${sharer} shared`
  );
}

/** Until `actor`'s board shows the game's known puzzle, noted as theirs. */
async function untilKnownPuzzleOnBoard(
  w: HarnessWorld,
  actor: Actor
): Promise<void> {
  const known = theKnownPuzzle(gameOf(w)).record.id;
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => readPuzzleOnBoard(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (id) => id === known,
  });
  await trackPuzzle(w, actor);
}

// ----------------------------------------------------------------- sharing

When('{actor} shares a puzzle link', async (w, actor: Actor) => {
  if (w.memo.has(sharedLinkKey(actor)))
    w.memo.set(earlierLinkKey(actor), sharedLink(w, actor));
  w.memo.set(sharedLinkKey(actor), await share(w, actor));
});

Given(
  '{actor} has shared a puzzle link to the puzzle on their board',
  async (w, actor: Actor) => {
    await ensureOnPuzzle(w, actor);
    w.memo.set(sharedLinkKey(actor), await share(w, actor));
  }
);

Given(
  "{actor} has shared a puzzle link to the game's known puzzle",
  async (w, actor: Actor) => {
    // The known puzzle reaches the sharer's board the way any one puzzle
    // does, whoever they are: from its puzzle link.
    await w.s.apply(focusActor, actor);
    await w.s.apply(
      openPuzzleLink,
      actor,
      puzzleLinkTo(theKnownPuzzle(gameOf(w)).record.id)
    );
    await untilKnownPuzzleOnBoard(w, actor);
    w.memo.set(sharedLinkKey(actor), await share(w, actor));
  }
);

Then(
  '{actor} has a puzzle link to the puzzle on their board',
  async (w, actor: Actor) => {
    const shared = required(
      await w.s.read(readSharedPuzzleLink, actor),
      `${actor}'s puzzle link`
    );
    expect(shared.link).toBe(sharedLink(w, actor));
    expect(shared.puzzleId).toBe(
      required(await w.s.read(readPuzzleOnBoard, actor), 'a puzzle on board')
    );
  }
);

Then('{actor} has the same puzzle link as before', (w, actor: Actor) => {
  expect(sharedLink(w, actor)).toBe(
    required(
      w.memo.get(earlierLinkKey(actor)) as string | undefined,
      `an earlier puzzle link of ${actor}'s`
    )
  );
});

// ----------------------------------------------------------------- opening

When(
  "{actor} opens {actor}'s puzzle link",
  async (w, opener: Actor, sharer: Actor) => {
    await w.s.apply(focusActor, opener);
    await w.s.apply(openPuzzleLink, opener, sharedLink(w, sharer));
  }
);

Given(
  "{actor} has opened {actor}'s puzzle link",
  async (w, opener: Actor, sharer: Actor) => {
    await w.s.apply(focusActor, opener);
    await w.s.apply(openPuzzleLink, opener, sharedLink(w, sharer));
    // Precondition guard: the linked puzzle is on the opener's board.
    await untilKnownPuzzleOnBoard(w, opener);
  }
);

Then(
  "{actor} has the game's known puzzle on their board",
  async (w, actor: Actor) => {
    await untilKnownPuzzleOnBoard(w, actor);
  }
);

Then("{actor}'s attempt is rated", async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => isPuzzleAttemptRated(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (rated) => rated === true,
  });
});

Then(
  '{actor} is told the puzzle is no longer available',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isPuzzleLinkUnavailableVisible(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);

Given(
  "{actor} has never played the game's known puzzle",
  async (w, actor: Actor) => {
    // Precondition guard: nothing on the device records an attempt at it.
    expect(
      await w.s.read(
        hasPlayedPuzzle,
        actor,
        theKnownPuzzle(gameOf(w)).record.id
      )
    ).toBe(false);
  }
);
