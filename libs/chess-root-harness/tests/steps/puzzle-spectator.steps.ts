/**
 * People watching a puzzle in a space: the host drives, the watcher sees
 * every move and may suggest one, a watcher's own move or skip of the host's
 * puzzle changes nothing, and someone arriving late (or coming back after the
 * connection drops) sees the host's current board.
 */

import { expect } from 'bun:test';

import {
  playNextSolutionMove,
  pressPuzzleNextIfVisible,
  suggestNonSolutionMove,
} from '@libs/chess-puzzle-harness/chess-actions';
import type { PuzzleSpectatorProbe } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import {
  isEmptyPoolVisible,
  isPuzzleSolved,
  readActivePuzzleId,
  readPuzzleDebug,
  readPuzzlePickState,
  readPuzzleSpectator,
  readPuzzleStatus,
} from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { puzzleBoardPair } from '@libs/chess-puzzle-harness/puzzle-board-pair-read';
import { readPuzzleControlAvailability } from '@libs/chess-puzzle-harness/puzzle-control-reads';
import { joinSpaceFromLink } from '@libs/friends-harness/spaces.steps';
import type { HostPuzzleCommand } from '@libs/game-session-harness/puzzle-room-probe';
import { attemptHostPuzzleCommand } from '@libs/game-session-harness/puzzle-room-probe';
import { Given, Then, When } from '@libs/harness/define';
import { accountIdOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import {
  activePuzzle,
  ensureOnPuzzle,
  rememberBoard,
  required,
  SECOND_MS,
  SETTLE_MS,
} from './puzzle-world';

type Suggestions = PuzzleSpectatorProbe['recommendations'];

async function spectatorProbe(w: HarnessWorld, actor: Actor) {
  await w.s.apply(focusActor, actor);
  return required(
    await w.s.read(readPuzzleSpectator, actor),
    `${actor}'s puzzle`
  );
}

/** Wait until `actor` sees exactly one suggestion, and it is `watcher`'s. */
async function untilOnlySuggestionBy(
  w: HarnessWorld,
  actor: Actor,
  watcher: Actor
): Promise<Suggestions> {
  const by = required(await w.s.read(accountIdOf, watcher), `${watcher}'s id`);
  await w.s.apply(focusActor, actor);
  const probe = await w.s.until((surf) => readPuzzleSpectator(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (p) =>
      p?.recommendations.length === 1 && p.recommendations[0]?.by === by,
  });
  return probe?.recommendations ?? [];
}

/** Wait until `watcher` is watching the puzzle now on `host`'s board. */
async function untilWatching(
  w: HarnessWorld,
  watcher: Actor,
  host: Actor,
  maxMs: number
): Promise<void> {
  await w.s.apply(focusActor, host);
  const puzzle = await activePuzzle(w, host);
  await w.s.apply(focusActor, watcher);
  await w.s.until(
    async (surf) => ({
      probe: await readPuzzleSpectator(surf, watcher),
      puzzle: await readActivePuzzleId(surf, watcher),
    }),
    {
      maxMs,
      pred: (seen) => seen.probe?.spectating === true && seen.puzzle === puzzle,
    }
  );
}

/** `second`'s board comes to show the position on `first`'s board. */
async function untilBoardsAgree(
  w: HarnessWorld,
  first: Actor,
  second: Actor,
  maxMs: number
): Promise<void> {
  await w.s.until((surf) => puzzleBoardPair(surf, first, second), {
    maxMs,
    pred: (boards) => boards.first !== null && boards.first === boards.second,
  });
}

// ---------------------------------------------------------------- watching

Given(
  "{actor} is watching {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    await w.s.apply(focusActor, watcher);
    if ((await w.s.read(readPuzzleStatus, watcher)) === null) {
      // Not in the host's space yet: join it from the host's link.
      await w.s.apply(focusActor, host);
      await ensureOnPuzzle(w, host);
      const link = required(await w.s.read(readSpaceLink, host), 'a space');
      await w.s.apply(joinViaLink, watcher, link);
    }
    await w.s.until(async (surf) => readPuzzleStatus(surf, watcher), {
      maxMs: SETTLE_MS,
      pred: (status) => status === 'solving',
    });
  }
);

Given(
  "{actor} has joined the space from the link and is watching {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    await joinSpaceFromLink(w, watcher);
    await untilWatching(w, watcher, host, SETTLE_MS);
  }
);

Then(
  "{actor} is watching {actor}'s puzzle within {int} seconds",
  async (w, watcher: Actor, host: Actor, seconds: number) => {
    await untilWatching(w, watcher, host, seconds * SECOND_MS);
  }
);

Then(
  '{actor} sees the puzzle solved within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isPuzzleSolved(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

/**
 * After the host's move, the opponent's reply keeps the board locked until
 * it finishes. A puzzle that move already ended stays locked: that is a
 * failure, not a pass.
 */
async function untilHostCanMove(w: HarnessWorld, actor: Actor): Promise<void> {
  const seen = await w.s.until(
    async (surf) => {
      if ((await readPuzzleDebug(surf, actor))?.interactive === true) {
        return 'interactive';
      }
      if (await isPuzzleSolved(surf, actor)) return 'solved';
      return null;
    },
    { maxMs: SETTLE_MS, pred: (state) => state !== null }
  );
  expect(seen).toBe('interactive');
}

Then(
  '{actor} is the host of the puzzle and can move pieces',
  async (w, actor: Actor) => {
    const probe = await spectatorProbe(w, actor);
    expect(probe.role).toBe('host');
    expect(probe.spectating).toBe(false);
    await untilHostCanMove(w, actor);
  }
);

Then(
  '{actor} is watching the puzzle and cannot move pieces',
  async (w, actor: Actor) => {
    const probe = await spectatorProbe(w, actor);
    expect(probe.role).toBe('guest');
    expect(probe.spectating).toBe(true);
    expect((await w.s.read(readPuzzleDebug, actor))?.interactive).toBe(false);
  }
);

// ------------------------------------------- driving is the host's alone

/**
 * The watcher sends the host-only command for the host's puzzle, the way a
 * modified app would (a watcher's own app never offers it), and the room
 * answers. The host's board is noted first, for "the board is unchanged".
 */
async function watcherAttempts(
  w: HarnessWorld,
  watcher: Actor,
  host: Actor,
  command: HostPuzzleCommand
): Promise<void> {
  await w.s.apply(focusActor, host);
  await rememberBoard(w, host);
  await w.s.apply(attemptHostPuzzleCommand, watcher, host, command);
}

When(
  "{actor} tries to play the next move of {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    await watcherAttempts(w, watcher, host, 'move');
  }
);

When(
  "{actor} tries to skip {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    await watcherAttempts(w, watcher, host, 'skip');
  }
);

When(
  "{actor} tries to move on from {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    await w.s.apply(focusActor, host);
    await rememberBoard(w, host);
    await w.s.apply(focusActor, watcher);
    // A watcher is not offered Next. Pressing it only if it is showing is
    // the attempt; a Next that advanced the host's puzzle fails the Then.
    await w.s.apply(pressPuzzleNextIfVisible, watcher);
  }
);

Then('{actor} is not offered a puzzle of his own', async (w, actor: Actor) => {
  expect(await w.s.read(readActivePuzzleId, actor)).toBeNull();
  expect(
    (await w.s.read(readPuzzleControlAvailability, actor)).moveOnOffered
  ).toBe(false);
  expect(
    (await w.s.read(readPuzzleControlAvailability, actor)).summaryMoveOnOffered
  ).toBe(false);
  expect(await w.s.read(isEmptyPoolVisible, actor)).toBe(false);
  const pick = await w.s.read(readPuzzlePickState, actor);
  expect(pick === null || pick === 'waiting').toBe(true);
});

// -------------------------------------------------------------- suggestions

When(
  '{actor} suggests a move that is not the solution',
  async (w, watcher: Actor) => {
    await w.s.apply(focusActor, watcher);
    await w.s.apply(suggestNonSolutionMove, watcher);
  }
);

Given(
  '{actor} has suggested a move that {actor} can see',
  async (w, watcher: Actor, host: Actor) => {
    await w.s.apply(focusActor, watcher);
    await w.s.apply(suggestNonSolutionMove, watcher);
    await untilOnlySuggestionBy(w, host, watcher);
  }
);

Then(
  "{actor} and {actor} both see only {actor}'s suggestion",
  async (w, first: Actor, second: Actor, watcher: Actor) => {
    const seen = [
      await untilOnlySuggestionBy(w, first, watcher),
      await untilOnlySuggestionBy(w, second, watcher),
    ];
    expect(seen[0]).toEqual(seen[1]);
  }
);

Then(
  '{actor} sees no suggestions within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => readPuzzleSpectator(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (probe) => probe?.recommendations.length === 0,
    });
  }
);

// ------------------------------------------------------------- host moves

When('{actor} plays the next move of the solution', async (w, host: Actor) => {
  await w.s.apply(focusActor, host);
  await w.s.apply(playNextSolutionMove, host);
});

Given(
  '{actor} has played the next move of the solution',
  async (w, host: Actor) => {
    await w.s.apply(focusActor, host);
    await w.s.apply(playNextSolutionMove, host);
  }
);

Then(
  "{actor}'s and {actor}'s boards agree",
  async (w, first: Actor, second: Actor) => {
    await untilBoardsAgree(w, first, second, SETTLE_MS);
  }
);

Then(
  "{actor}'s and {actor}'s boards agree within {int} seconds",
  async (w, first: Actor, second: Actor, seconds: number) => {
    await untilBoardsAgree(w, first, second, seconds * SECOND_MS);
  }
);
