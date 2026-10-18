/**
 * Puzzle links: sharing the link to the puzzle on the board, and opening
 * someone's link — that exact puzzle on the board, rated only on a first
 * attempt, or why it cannot open.
 */

import { expect } from 'bun:test';
import { ingestChessPuzzleCsv } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { hasPlayedPuzzle } from '@libs/chess-puzzle-harness/chess-puzzle-ledger-data';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import {
  isPuzzleLinkUnavailableVisible,
  openPuzzleLink,
  puzzleLinkTo,
  readSharedPuzzleLink,
  sharePuzzleLink,
} from '@libs/chess-puzzle-harness/puzzle-link-ui';
import {
  isPuzzleAttemptRated,
  readPuzzleOnBoard,
} from '@libs/game-session-harness/puzzle-screen';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { recall, remember } from '@libs/harness/spec-world';
import {
  ensureOnPuzzle,
  required,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

const sharedLinkKey = (actor: Actor) => `puzzleLink:${actor}`;
const earlierLinkKey = (actor: Actor) => `earlierPuzzleLink:${actor}`;

/** Share the link to the puzzle on the actor's board; the link shared. */
async function share(w: HarnessWorld, actor: Actor): Promise<string> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(sharePuzzleLink, actor);
  const shared = required(
    await w.s.read(readSharedPuzzleLink, actor),
    `${actor}'s puzzle link`
  );
  return shared.link;
}

function sharedLink(w: HarnessWorld, sharer: Actor): string {
  return recall(w, sharedLinkKey(sharer)) as string;
}

async function openLink(
  w: HarnessWorld,
  opener: Actor,
  sharer: Actor
): Promise<void> {
  await w.s.apply(focusActor, opener);
  await w.s.apply(openPuzzleLink, opener, sharedLink(w, sharer));
}

// ----------------------------------------------------------------- sharing

When('{actor} shares a puzzle link', async (w, actor: Actor) => {
  if (w.memo.has(sharedLinkKey(actor))) {
    remember(w, earlierLinkKey(actor), sharedLink(w, actor));
  }
  remember(w, sharedLinkKey(actor), await share(w, actor));
});

Given(
  '{actor} has shared a puzzle link to the puzzle on their board',
  async (w, actor: Actor) => {
    await ensureOnPuzzle(w, actor);
    remember(w, sharedLinkKey(actor), await share(w, actor));
  }
);

Given(
  '{actor} has shared a puzzle link to the hook-mate puzzle',
  async (w, actor: Actor) => {
    // The hook-mate puzzle reaches the sharer's board the way any one
    // puzzle does whoever they are: from its puzzle link.
    const puzzle = NAMED_PUZZLES.hookMate;
    if (puzzle.csv !== null) await w.s.apply(ingestChessPuzzleCsv, puzzle.csv);
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleLink, actor, puzzleLinkTo(puzzle.id));
    await w.s.until((surf) => readPuzzleOnBoard(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (id) => id === puzzle.id,
    });
    await trackPuzzle(w, actor);
    remember(w, sharedLinkKey(actor), await share(w, actor));
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

Then('{actor} has the same puzzle link as before', async (w, actor: Actor) => {
  expect(sharedLink(w, actor)).toBe(recall(w, earlierLinkKey(actor)) as string);
});

// ----------------------------------------------------------------- opening

When(
  "{actor} opens {actor}'s puzzle link",
  async (w, opener: Actor, sharer: Actor) => {
    await openLink(w, opener, sharer);
  }
);

Given(
  "{actor} has opened {actor}'s puzzle link",
  async (w, opener: Actor, sharer: Actor) => {
    await openLink(w, opener, sharer);
    // Precondition guard: the linked puzzle is on the opener's board.
    await w.s.until((surf) => readPuzzleOnBoard(surf, opener), {
      maxMs: SETTLE_MS,
      pred: (id) => id === NAMED_PUZZLES.hookMate.id,
    });
    await trackPuzzle(w, opener);
  }
);

Then(
  '{actor} has the hook-mate puzzle on their board',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => readPuzzleOnBoard(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (id) => id === NAMED_PUZZLES.hookMate.id,
    });
    await trackPuzzle(w, actor);
  }
);

Then("{actor}'s attempt is rated", async (w, actor: Actor) => {
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
  '{actor} has never played the hook-mate puzzle',
  async (w, actor: Actor) => {
    // Precondition guard: nothing on the device records an attempt at it.
    expect(
      await w.s.read(hasPlayedPuzzle, actor, NAMED_PUZZLES.hookMate.id)
    ).toBe(false);
  }
);
