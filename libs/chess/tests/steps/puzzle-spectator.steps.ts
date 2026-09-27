/**
 * Friends watching a puzzle in a space: the host drives, the watcher sees
 * every move and may suggest one, and a watcher's own move or skip of the
 * host's puzzle changes nothing.
 * People watching a puzzle in a space: the host drives, the watcher sees
 * every move and may suggest one, and someone arriving late (or coming back
 * after the connection dropped) sees the host's current board. That a
 * watcher's own command is refused is pinned in
 * `tests/e2e/watcher-command-refused`.
 */

import { expect } from 'bun:test';

import {
  playNextSolutionMove,
  suggestNonSolutionMove,
} from '@libs/chess/sim/chess-actions';
import {
  attemptHostPuzzleCommand,
  type HostPuzzleCommand,
} from '@libs/chess/sim/chess-puzzle-room-probe';
import {
  isPuzzleSolved,
  type PuzzleSpectatorProbe,
  readActivePuzzleId,
  readPuzzleDebug,
  readPuzzleDisplayFen,
  readPuzzleSpectator,
  readPuzzleStatus,
} from '@libs/chess/sim/chess-puzzle-ui';
import { joinSpaceFromLink } from '@libs/friends/steps/spaces.steps';
import { focusActor } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import {
  activePuzzle,
  rememberBoard,
  required,
  SECOND_MS,
  SETTLE_MS,
} from './puzzle-world';

type Suggestions = PuzzleSpectatorProbe['recommendations'];

async function spectatorProbe(w: SimWorld, actor: Actor) {
  await w.s.apply(focusActor, actor);
  return required(
    await w.s.read(readPuzzleSpectator, actor),
    `${actor}'s puzzle`
  );
}

/** Wait until `actor` sees exactly one suggestion, and it is `watcher`'s. */
async function untilOnlySuggestionBy(
  w: SimWorld,
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
  w: SimWorld,
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
  w: SimWorld,
  first: Actor,
  second: Actor,
  maxMs: number
): Promise<void> {
  await w.s.apply(focusActor, first);
  const fen = required(
    await w.s.read(readPuzzleDisplayFen, first),
    `${first}'s board`
  );
  await w.s.apply(focusActor, second);
  await w.s.until(async (surf) => readPuzzleDisplayFen(surf, second), {
    maxMs,
    pred: (other) => other === fen,
  });
}

// ---------------------------------------------------------------- watching

Given("{actor} is watching {actor}'s puzzle", async (w, watcher: Actor) => {
  await w.s.apply(focusActor, watcher);
  await w.s.until(async (surf) => readPuzzleStatus(surf, watcher), {
    maxMs: SETTLE_MS,
    pred: (status) => status === 'solving',
  });
});

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
  '{actor} is the host of the puzzle and can move pieces',
  async (w, actor: Actor) => {
    const probe = await spectatorProbe(w, actor);
    expect(probe.role).toBe('host');
    expect(probe.spectating).toBe(false);
    expect((await w.s.read(readPuzzleDebug, actor))?.interactive).toBe(true);
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
  w: SimWorld,
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
