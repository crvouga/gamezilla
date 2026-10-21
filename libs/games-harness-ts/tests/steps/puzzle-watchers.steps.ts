/**
 * People watching a puzzle of the run's game in its host's space: the host
 * drives it, a watcher sees every move and may suggest one, a watcher's own
 * move, skip or move-on changes nothing, and someone arriving late (or back
 * after the connection drops) sees the host's current board.
 */

import { expect } from 'bun:test';
import { joinSpaceFromLink } from '@libs/friends-harness-ts/spaces.steps';
import { suggestMoveToHost } from '@libs/game-session-harness-ts/puzzle-moves';
import { isGameLogEmpty } from '@libs/game-session-harness-ts/puzzle-records';
import type { HostPuzzleCommand } from '@libs/game-session-harness-ts/puzzle-room-probe';
import { attemptHostPuzzleCommand } from '@libs/game-session-harness-ts/puzzle-room-probe';
import type { PuzzleWatchProbe } from '@libs/game-session-harness-ts/puzzle-screen';
import {
  askForNextPuzzle,
  isEmptyFeedShown,
  isPuzzleSolved,
  leavePuzzleForGameChoices,
  readPuzzleBoardPair,
  readPuzzleControls,
  readPuzzleOnBoard,
  readPuzzlePickState,
  readPuzzleProbe,
  readPuzzleWatch,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { Given, Then, When } from '@libs/harness-ts/define';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  focusPuzzle,
  focusStats,
  puzzleGameId,
  rememberBoard,
  required,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

type Suggestions = PuzzleWatchProbe['suggestions'];

async function watchProbe(w: HarnessWorld, actor: Actor) {
  await w.s.apply(focusActor, actor);
  return required(await w.s.read(readPuzzleWatch, actor), `${actor}'s puzzle`);
}

/** Wait until `actor` sees exactly one suggestion, and it is `watcher`'s. */
async function untilOnlySuggestionBy(
  w: HarnessWorld,
  actor: Actor,
  watcher: Actor
): Promise<Suggestions> {
  const by = required(await w.s.read(accountIdOf, watcher), `${watcher}'s id`);
  await w.s.apply(focusActor, actor);
  const probe = await w.s.until((surf) => readPuzzleWatch(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (seen) =>
      seen?.suggestions.length === 1 && seen.suggestions[0]?.by === by,
  });
  return probe?.suggestions ?? [];
}

/** Wait until `watcher` is watching the puzzle now on `host`'s board. */
async function untilWatching(
  w: HarnessWorld,
  watcher: Actor,
  host: Actor,
  maxMs: number
): Promise<void> {
  await w.s.apply(focusActor, host);
  const puzzle = await trackPuzzle(w, host);
  await w.s.apply(focusActor, watcher);
  await w.s.until(
    async (surf) => ({
      probe: await readPuzzleWatch(surf, watcher),
      puzzle: await readPuzzleOnBoard(surf, watcher),
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
  await w.s.until((surf) => readPuzzleBoardPair(surf, first, second), {
    maxMs,
    pred: (boards) => boards.first !== null && boards.first === boards.second,
  });
}

// ---------------------------------------------------------------- watching

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

Then(
  '{actor} is the host of the puzzle and can make a move',
  async (w, actor: Actor) => {
    const probe = await watchProbe(w, actor);
    expect(probe.role).toBe('host');
    expect(probe.spectating).toBe(false);
    // The opponent's reply locks the board until it is played; a puzzle
    // that move ended stays locked, which fails here.
    const seen = await w.s.until(
      async (surf) => {
        if ((await readPuzzleProbe(surf, actor))?.interactive === true)
          return 'takes a move';
        if (await isPuzzleSolved(surf, actor)) return 'solved';
        return null;
      },
      { maxMs: SETTLE_MS, pred: (state) => state !== null }
    );
    expect(seen).toBe('takes a move');
  }
);

Then(
  '{actor} is watching the puzzle and cannot make a move',
  async (w, actor: Actor) => {
    const probe = await watchProbe(w, actor);
    expect(probe.role).toBe('guest');
    expect(probe.spectating).toBe(true);
    expect((await w.s.read(readPuzzleProbe, actor))?.interactive).toBe(false);
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

// ------------------------------------------- driving is the host's alone

/**
 * The watcher sends the host's command for the host's puzzle, the way a
 * modified app would (a watcher's own app never offers it), and the room
 * answers. The host's board is noted first, for "the board is unchanged".
 */
async function watcherAttempts(
  w: HarnessWorld,
  watcher: Actor,
  host: Actor,
  command: HostPuzzleCommand
): Promise<void> {
  await focusPuzzle(w, host);
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
    await focusPuzzle(w, host);
    await rememberBoard(w, host);
    await w.s.apply(focusActor, watcher);
    // A watcher is not offered Next: pressing it only if it shows is the
    // attempt, and a Next that moved the host's puzzle on fails the Then.
    await w.s.apply(askForNextPuzzle, watcher);
  }
);

When(
  "{actor} leaves the puzzle for the game's choices",
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    await w.s.apply(leavePuzzleForGameChoices, actor);
  }
);

Then('{actor} is not offered a puzzle of his own', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(readPuzzleOnBoard, actor)).toBeNull();
  const controls = await w.s.read(readPuzzleControls, actor);
  expect(controls.moveOnOffered).toBe(false);
  expect(controls.resultMoveOnOffered).toBe(false);
  expect(await w.s.read(isEmptyFeedShown, actor)).toBe(false);
  const pick = await w.s.read(readPuzzlePickState, actor);
  expect(pick === null || pick === 'waiting').toBe(true);
});

Then(
  "{actor}'s game log is empty within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await focusStats(w, actor);
    await w.s.until((surf) => isGameLogEmpty(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

// -------------------------------------------------------------- suggestions

When(
  '{actor} suggests a move that is not the solution',
  async (w, watcher: Actor) => {
    await w.s.apply(focusActor, watcher);
    await w.s.apply(suggestMoveToHost, watcher, puzzleGameId(w));
  }
);

Given(
  '{actor} has suggested a move that {actor} can see',
  async (w, watcher: Actor, host: Actor) => {
    await w.s.apply(focusActor, watcher);
    await w.s.apply(suggestMoveToHost, watcher, puzzleGameId(w));
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
    await w.s.until((surf) => readPuzzleWatch(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (probe) => probe?.suggestions.length === 0,
    });
  }
);
