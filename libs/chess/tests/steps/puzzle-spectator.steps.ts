/**
 * Friends watching a puzzle in a space: the host drives, the watcher sees
 * every move, may suggest one, and is refused when trying to drive.
 */

import { expect } from 'bun:test';

import {
  playPuzzleMove,
  suggestPuzzleMove,
} from '@libs/chess/sim/chess-actions';
import {
  attemptHostPuzzleCommand,
  readPuzzleCommandOutcome,
} from '@libs/chess/sim/chess-puzzle-room-probe';
import {
  isPuzzleSolved,
  pickWrongUci,
  readPuzzleDebug,
  readPuzzleDisplayFen,
  readPuzzleSpectator,
  readPuzzleStatus,
} from '@libs/chess/sim/chess-puzzle-ui';
import { focusActor } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { remember } from '@libs/sim-harness/spec/world';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  recalled,
  required,
  SECOND_MS,
  SETTLE_MS,
  waitSolverToMove,
} from './puzzle-world';

const hostKey = (watcher: Actor) => `watching:${watcher}`;
const suggestionKey = (watcher: Actor) => `suggestion:${watcher}`;

type Suggestion = { readonly from: Square; readonly to: Square };

function hostOf(w: SimWorld, watcher: Actor): Actor {
  return recalled<Actor>(w, hostKey(watcher));
}

async function spectatorProbe(w: SimWorld, actor: Actor) {
  await w.s.apply(focusActor, actor);
  return required(
    await w.s.read(readPuzzleSpectator, actor),
    `${actor}'s puzzle`
  );
}

/** A legal move on the watched board that is not the host's next move. */
async function suggest(w: SimWorld, watcher: Actor): Promise<Suggestion> {
  await w.s.apply(focusActor, watcher);
  const debug = required(
    await w.s.read(readPuzzleDebug, watcher),
    `${watcher}'s puzzle`
  );
  const fen = required(
    await w.s.read(readPuzzleDisplayFen, watcher),
    `${watcher}'s board`
  );
  const uci = pickWrongUci(fen, debug.solutionUci);
  const suggestion = {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
  };
  await w.s.apply(suggestPuzzleMove, watcher, suggestion.from, suggestion.to);
  return remember(w, suggestionKey(watcher), suggestion);
}

/** Suggestions `actor` sees, once they are exactly `expected`. */
async function untilSuggestions(
  w: SimWorld,
  actor: Actor,
  expected: readonly { by: string; from: string; to: string }[],
  maxMs: number
): Promise<void> {
  await w.s.apply(focusActor, actor);
  const same = (
    recs: readonly { by: string; from: string; to: string }[] | undefined
  ) =>
    recs !== undefined &&
    recs.length === expected.length &&
    expected.every((e) =>
      recs.some((r) => r.by === e.by && r.from === e.from && r.to === e.to)
    );
  await w.s.until((surf) => readPuzzleSpectator(surf, actor), {
    maxMs,
    pred: (probe) => same(probe?.recommendations),
  });
}

async function watcherSuggestion(w: SimWorld, watcher: Actor) {
  const suggestion = recalled<Suggestion>(w, suggestionKey(watcher));
  const by = required(await w.s.read(accountIdOf, watcher), `${watcher}'s id`);
  return { by, ...suggestion };
}

// ---------------------------------------------------------------- watching

Given(
  "{actor} is watching {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    remember(w, hostKey(watcher), host);
    await w.s.apply(focusActor, watcher);
    await w.s.until(async (surf) => readPuzzleStatus(surf, watcher), {
      maxMs: SETTLE_MS,
      pred: (status) => status === 'solving',
    });
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

// -------------------------------------------------------------- suggestions

When('{actor} suggests a move', async (w, watcher: Actor) => {
  await suggest(w, watcher);
});

When(
  '{actor} suggests a move that is not the solution',
  async (w, watcher: Actor) => {
    await suggest(w, watcher);
  }
);

Given(
  '{actor} has suggested a move that {actor} can see',
  async (w, watcher: Actor, host: Actor) => {
    await suggest(w, watcher);
    await untilSuggestions(
      w,
      host,
      [await watcherSuggestion(w, watcher)],
      SETTLE_MS
    );
  }
);

Then(
  "{actor} sees {actor}'s suggested move within {int} seconds",
  async (w, host: Actor, watcher: Actor, seconds: number) => {
    await untilSuggestions(
      w,
      host,
      [await watcherSuggestion(w, watcher)],
      seconds * SECOND_MS
    );
  }
);

Then(
  '{actor} sees exactly {int} suggestion(s)',
  async (w, actor: Actor, count: number) => {
    expect((await spectatorProbe(w, actor)).recommendations).toHaveLength(
      count
    );
  }
);

Then(
  "{actor} and {actor} both see only {actor}'s suggestion",
  async (w, first: Actor, second: Actor, watcher: Actor) => {
    const expected = [await watcherSuggestion(w, watcher)];
    // The suggestion crosses the room to the host; let it land.
    for (const actor of [first, second]) {
      await untilSuggestions(w, actor, expected, SETTLE_MS);
    }
  }
);

Then(
  '{actor} sees no suggestions within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await untilSuggestions(w, actor, [], seconds * SECOND_MS);
  }
);

Then('{actor} sees no suggestions', async (w, actor: Actor) => {
  expect((await spectatorProbe(w, actor)).recommendations).toEqual([]);
});

When('{actor} plays the next move of the solution', async (w, host: Actor) => {
  await w.s.apply(focusActor, host);
  await waitSolverToMove(w, host);
  const before = required(
    await w.s.read(readPuzzleDisplayFen, host),
    `${host}'s board`
  );
  const uci = required(
    await w.s.read(readPuzzleDebug, host),
    `${host}'s puzzle`
  ).solutionUci;
  await w.s.apply(playPuzzleMove, host, uci);
  await w.s.until(async (surf) => readPuzzleDisplayFen(surf, host), {
    maxMs: SETTLE_MS,
    pred: (fen) => fen !== null && fen !== before,
  });
});

Then(
  "{actor}'s and {actor}'s boards agree",
  async (w, first: Actor, second: Actor) => {
    await w.s.apply(focusActor, first);
    const fen = required(
      await w.s.read(readPuzzleDisplayFen, first),
      `${first}'s board`
    );
    await w.s.apply(focusActor, second);
    await w.s.until(async (surf) => readPuzzleDisplayFen(surf, second), {
      maxMs: SETTLE_MS,
      pred: (other) => other === fen,
    });
  }
);

// ---------------------------------------------------------------- refusals

/** The watcher sends the command itself; the host's screen shows the result. */
async function attempt(
  w: SimWorld,
  watcher: Actor,
  command: 'move' | 'skip'
): Promise<void> {
  const host = hostOf(w, watcher);
  await w.s.apply(focusActor, host);
  await w.s.apply(attemptHostPuzzleCommand, watcher, host, command);
}

When(
  "{actor} tries to play the host's next move",
  async (w, watcher: Actor) => {
    await attempt(w, watcher, 'move');
  }
);

When('{actor} tries to skip the puzzle', async (w, watcher: Actor) => {
  await attempt(w, watcher, 'skip');
});

Then('{actor} is refused as not allowed', async (w, watcher: Actor) => {
  const outcome = required(
    await w.s.read(readPuzzleCommandOutcome, watcher),
    `the room's answer to ${watcher}`
  );
  expect(outcome.kind).toBe('refused');
  if (outcome.kind === 'refused') {
    expect(outcome.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  }
});
