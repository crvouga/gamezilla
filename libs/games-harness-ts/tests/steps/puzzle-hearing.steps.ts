/**
 * Puzzles of the run's game heard and played without a pointer: the app's
 * sounds as the puzzle and its review play them (or keep silent), what
 * someone listening to the app hears of each result, and every puzzle
 * control from the keyboard alone.
 */

import { expect } from 'bun:test';
import {
  listenToPuzzles,
  readPuzzleResultHeard,
  usePuzzleControlWithKeyboard,
} from '@libs/game-session-harness-ts/puzzle-listening';
import { readShownRatingChange } from '@libs/game-session-harness-ts/puzzle-screen';
import {
  puzzleContinuationSounds,
  readPuzzleSoundsPlayed,
} from '@libs/game-session-harness-ts/puzzle-sounds';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  configureSounds,
  readSoundsOn,
} from '@libs/harness-ts/sounds-preference';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { turnGameOf } from './game-world';
import {
  focusPuzzle,
  noteSoundsSoFar,
  puzzleGameId,
  required,
  SETTLE_MS,
  soundsNoted,
  trackPuzzle,
} from './puzzle-world';

/** How long a sound already due has to play. */
const SOUND_MS = 1_000;

/** Until `actor` has heard, since the last note, what `heard` accepts. */
async function untilHeard(
  w: HarnessWorld,
  actor: Actor,
  heard: (sounds: readonly string[]) => boolean
): Promise<void> {
  const from = soundsNoted(w, actor);
  const gameId = puzzleGameId(w);
  await w.s.until((surf) => readPuzzleSoundsPlayed(surf, actor, gameId), {
    maxMs: SETTLE_MS,
    pred: (played) => heard(played.slice(from)),
  });
}

/** `actor` hears no puzzle sound since the last note, for a while. */
async function hearsNothing(w: HarnessWorld, actor: Actor): Promise<void> {
  const from = soundsNoted(w, actor);
  const gameId = puzzleGameId(w);
  await w.s.never((surf) => readPuzzleSoundsPlayed(surf, actor, gameId), {
    forMs: SOUND_MS,
    pred: (played) => played.length > from,
  });
}

function sorted(sounds: readonly string[]): readonly string[] {
  return [...sounds].sort();
}

// ------------------------------------------------------------ the sounds

When('{actor} turns sounds off', async (w, actor: Actor) => {
  await noteSoundsSoFar(w, actor);
  await w.s.apply(configureSounds, actor, false);
});

When('{actor} turns sounds on', async (w, actor: Actor) => {
  await noteSoundsSoFar(w, actor);
  await w.s.apply(configureSounds, actor, true);
});

Given(
  '{actor} has since turned sounds off and returned to that unfinished puzzle',
  async (w, actor: Actor) => {
    await w.s.apply(configureSounds, actor, false);
    await focusPuzzle(w, actor);
  }
);

Then("{actor}'s sounds are off", async (w, actor: Actor) => {
  expect(await w.s.read(readSoundsOn, actor)).toBe(false);
});

Then("{actor}'s sounds are on", async (w, actor: Actor) => {
  expect(await w.s.read(readSoundsOn, actor)).toBe(true);
});

Then("{actor} hears the puzzle's move sounds", async (w, actor: Actor) => {
  // regression: solver-only-hearing-requires-reply
  // solo-count:3w, [two, two] has one move sound, without an opponent reply.
  const expected = puzzleContinuationSounds(turnGameOf(w));
  await untilHeard(
    w,
    actor,
    (sounds) => JSON.stringify(sorted(sounds)) === JSON.stringify(expected)
  );
});

Then(
  "{actor} hears the puzzle's wrong-move feedback",
  async (w, actor: Actor) => {
    await untilHeard(
      w,
      actor,
      (sounds) => sounds.filter((sound) => sound === 'wrong move').length === 1
    );
  }
);

Then("{actor} hears the review's move sound", async (w, actor: Actor) => {
  // The last move of the line, and the end of the line it reaches.
  await untilHeard(
    w,
    actor,
    (sounds) =>
      JSON.stringify([...new Set(sorted(sounds))]) ===
      JSON.stringify(['end', 'move'])
  );
});

Then('{actor} hears no new puzzle feedback', async (w, actor: Actor) => {
  await hearsNothing(w, actor);
});

Then(
  "{actor} cannot hear puzzle sounds while the app's sounds are off",
  async (w, actor: Actor) => {
    expect(await w.s.read(readSoundsOn, actor)).toBe(false);
    await hearsNothing(w, actor);
  }
);

// --------------------------------------------------------------- listening

/** What `actor` hears of the results once it says every one of `words`. */
async function hears(
  w: HarnessWorld,
  actor: Actor,
  words: readonly string[]
): Promise<void> {
  await w.s.apply(focusActor, actor);
  const heard = await w.s.until((surf) => readPuzzleResultHeard(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (now) => words.every((word) => now.words.includes(word)),
  });
  expect(heard.problems).toEqual([]);
}

Given('{actor} is listening to the app', async (w, actor: Actor) => {
  await w.s.apply(listenToPuzzles, actor);
});

Then(
  '{actor} hears in words that the move was wrong',
  async (w, actor: Actor) => {
    await hears(w, actor, ['Wrong move']);
  }
);

Then('{actor} hears the puzzle is solved', async (w, actor: Actor) => {
  await hears(w, actor, ['Puzzle solved']);
});

Then('{actor} hears their rating change', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  const shown = required(
    await w.s.until((surf) => readShownRatingChange(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (change) => change !== null,
    }),
    `${actor}'s rating change`
  );
  const said = {
    raised: 'went up by',
    lowered: 'went down by',
    unchanged: 'stayed at',
    unrated: 'unrated',
  } as const;
  await hears(w, actor, [said[shown]]);
});

// ---------------------------------------------------------------- keyboard

When('{actor} asks for a hint with the keyboard', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.apply(usePuzzleControlWithKeyboard, actor, 'hint');
});

When(
  '{actor} retries the puzzle with the keyboard',
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    await w.s.apply(usePuzzleControlWithKeyboard, actor, 'retry');
  }
);

When(
  '{actor} shows the solution with the keyboard',
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    await w.s.apply(usePuzzleControlWithKeyboard, actor, 'solution');
  }
);

When('{actor} skips the puzzle with the keyboard', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.apply(usePuzzleControlWithKeyboard, actor, 'skip');
});

When(
  '{actor} moves on to the next puzzle with the keyboard',
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    await w.s.apply(usePuzzleControlWithKeyboard, actor, 'next');
    await trackPuzzle(w, actor);
  }
);
