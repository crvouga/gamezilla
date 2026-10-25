/**
 * `specs/games/puzzle-link.qnt` on the product, for each conformance game
 * offering puzzles: Alice shares the link to the game's known puzzle on her
 * board; Bob, a guest who has started 18, 19 or 20 rated puzzles today and
 * may already have played it, opens it. Either device can lose its
 * connection; the team can retire the puzzle.
 */

import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  readLocalPuzzleStartLedger,
  startUnnamedPuzzle,
  useUpPuzzleStartsToday,
} from '@libs/game-session-harness-ts/puzzle-allowance';
import type { PuzzleLinkOutcome } from '@libs/game-session-harness-ts/puzzle-link';
import {
  openPuzzleLink,
  puzzleLinkTo,
  readPuzzleLinkOutcome,
  readSharedPuzzleLink,
  sharePuzzleLink,
} from '@libs/game-session-harness-ts/puzzle-link';
import {
  solveKnownPuzzle,
  theKnownPuzzle,
} from '@libs/game-session-harness-ts/puzzle-moves';
import { retireCataloguePuzzle } from '@libs/game-session-harness-ts/puzzle-records';
import {
  isPuzzleAttemptRated,
  moveOnToNextPuzzle,
  readPuzzleStartsLeft,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { turnConformanceGameOf } from '../conformance-world';
import lostRequest from './fixtures/puzzle-link-request-cleared-before-placement.itf.json';

const SHARER = 'alice';
const OPENER = 'bob';
/** The model's daily puzzle limit: rated puzzles a guest may start a day. */
const DAILY_PUZZLE_LIMIT = 20;
const SETTLE_MS = 20_000;
const LINK_KEY = 'puzzle-link';

const REFUSALS: Readonly<Record<PuzzleLinkOutcome, string>> = {
  linked: 'none',
  other: 'none',
  dailyLimit: 'daily puzzle limit reached',
  unavailable: 'puzzle no longer available',
  offline: 'puzzles need a connection',
};

function gameOfTrace(w: QuintHarnessWorld): TurnHarnessGame {
  return turnConformanceGameOf(w.ctx.variant, w.ctx.title);
}

/** The linked puzzle: the game's known puzzle. */
function linkedPuzzle(w: QuintHarnessWorld): string {
  return theKnownPuzzle(gameOfTrace(w)).record.id;
}

/** Put the game's known puzzle on `actor`'s board from its puzzle link. */
async function openKnownPuzzle(w: QuintHarnessWorld, actor: string) {
  const puzzle = linkedPuzzle(w);
  await w.s.apply(focusActor, actor);
  await w.s.apply(openPuzzleLink, actor, puzzleLinkTo(puzzle));
  await w.s.until((s) => readPuzzleLinkOutcome(s, actor, puzzle), {
    maxMs: SETTLE_MS,
    pred: (outcome) => outcome === 'linked',
  });
}

/** Bob, a guest on a puzzle, after `starts` rated starts today. */
async function prepareOpener(
  w: QuintHarnessWorld,
  starts: number,
  playedBefore: boolean
) {
  const gameId = gameOfTrace(w).shared.id;
  await w.s.apply(createSpace, OPENER);
  await w.s.apply(startUnnamedPuzzle, OPENER, gameId);
  if (playedBefore) {
    await openKnownPuzzle(w, OPENER);
    await w.s.apply(solveKnownPuzzle, OPENER, gameId);
    await w.s.apply(moveOnToNextPuzzle, OPENER);
  }
  const used = (await w.s.read(readLocalPuzzleStartLedger, OPENER)).length;
  await w.s.apply(useUpPuzzleStartsToday, OPENER, starts - used + 1);
}

function picked(picks: Picks, key: string): unknown {
  return picks[key];
}

async function startsShown(w: QuintHarnessWorld): Promise<number> {
  const remaining = await w.quiet.read(readPuzzleStartsLeft, OPENER);
  if (remaining !== null) return DAILY_PUZZLE_LIMIT - remaining;
  // Off the puzzle screen (a link that did not open), the device's own
  // count of today's starts.
  return (await w.quiet.read(readLocalPuzzleStartLedger, OPENER)).length;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-link',
  traces: 16,
  maxSteps: 8,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: puzzle-link-request-cleared-before-placement
      id: 'puzzle-link-request-cleared-before-placement',
      title: 'A puzzle link replaces a puzzle already on the board',
      seed: '0x67932',
      itf: lostRequest,
    },
    {
      // regression: puzzle-quota-fixture-not-published
      id: 'puzzle-quota-fixture-not-published',
      title: 'Earlier rated starts reach the open puzzle board',
      seed: '0x67932',
      itf: lostRequest,
    },
  ],
  actions: {
    init: async (w, picks) => {
      await openKnownPuzzle(w, SHARER);
      await prepareOpener(
        w,
        Number(picked(picks, 'starts')),
        picked(picks, 'playedBefore') === true
      );
    },
    sharePuzzleLink: async (w) => {
      await w.s.apply(focusActor, SHARER);
      await w.s.apply(sharePuzzleLink, SHARER);
      const shared = await w.s.read(readSharedPuzzleLink, SHARER);
      w.memo.set(LINK_KEY, shared?.link ?? null);
    },
    openPuzzleLink: async (w) => {
      const link = w.memo.get(LINK_KEY);
      if (typeof link !== 'string') throw new Error('no puzzle link shared');
      await w.s.apply(focusActor, OPENER);
      await w.s.apply(openPuzzleLink, OPENER, link);
      await w.s.until(
        (s) => readPuzzleLinkOutcome(s, OPENER, linkedPuzzle(w)),
        {
          maxMs: SETTLE_MS,
          pred: (outcome) => outcome !== 'other',
        }
      );
    },
    retirePuzzle: (w) => w.s.apply(retireCataloguePuzzle, linkedPuzzle(w)),
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picked(picks, 'device'))),
    connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picked(picks, 'device'))),
    _wait: (w) => w.s.advanceTime(1_000),
  },
  observe: async (w) => {
    const outcome = await w.quiet.read(
      readPuzzleLinkOutcome,
      OPENER,
      linkedPuzzle(w)
    );
    const linked = outcome === 'linked';
    return {
      puzzle: linked ? 'linked' : 'none',
      rated:
        linked && (await w.quiet.read(isPuzzleAttemptRated, OPENER)) === true,
      puzzleStarts: await startsShown(w),
      linkShared: (await w.quiet.read(readSharedPuzzleLink, SHARER)) !== null,
      linkRefusal: REFUSALS[outcome],
    };
  },
});
