/**
 * Probe: a puzzle with no opponent. One person counts on by one, two or three and
 * solves a puzzle by reaching seven in the moves it allows; nobody replies.
 * Only the first side ever moves. Offers puzzles only.
 * Staying put is a legal action, but never advances the solution.
 *
 * Every move of a puzzle's line is the solver's. The shared suites consume
 * the same checked adapter as a game author supplies.
 */

import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import type {
  PuzzleBoardProps,
  PuzzleFeedback,
} from '@libs/game-puzzle-client-ts/puzzle-client';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { PuzzleFixture } from '@libs/game-session-harness-ts/known-puzzles';
import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import {
  createAudioPlayer,
  createPlayFromStartHandles,
  useSoundsPreference,
} from '@pkgs/sounds-client-ts/solid';
import { soundAssetUrls } from '@pkgs/sounds-shared-ts/sound-urls';
import type {
  PuzzleRecord,
  PuzzlesCapability,
} from '@pkgs/turn-game-shared-ts/game-puzzles';
import type { TurnGameCapabilities } from '@pkgs/turn-game-shared-ts/game-rules';
import { createEffect, For, on } from 'solid-js';
import { countRules } from './count-rules';
import { probeAutomation, probePresentation } from './probe-parts';

export const SOLO_COUNT_RULES = countRules({
  id: 'solo-count',
  steps: { one: 1, two: 2, three: 3, stay: 0 },
  finish: 7,
  singlePlayer: true,
  next: () => 'white',
  ending: (mover) => ({ winner: mover, reason: 'counted to seven' }),
});

const CELLS = ['0', '1', '2', '3', '4', '5', '6', '7'];
const SOUNDS = {
  move: soundAssetUrls['gameplay.move'],
  right: soundAssetUrls['gameplay.checkpoint'],
  wrong: soundAssetUrls['gameplay.invalidMove'],
  end: soundAssetUrls['gameplay.victory'],
};

function PuzzleBoard(props: PuzzleBoardProps) {
  const handles = createPlayFromStartHandles({
    move: createAudioPlayer(SOUNDS.move),
    end: createAudioPlayer(SOUNDS.end),
  });
  createEffect(
    on(
      () => props.position,
      (position, before) => {
        if (!props.sound || position === before) return;
        handles.move.play();
        if (position === 'solo-count:7w') handles.end.play();
      },
      { defer: true }
    )
  );
  const mark = (cell: string) =>
    [
      props.marks.wrong === cell ? 'wrong' : '',
      props.marks.hint === cell ? 'hint' : '',
      props.marks.solution?.from === cell ? 'from' : '',
      props.marks.solution?.to === cell ? 'to' : '',
    ]
      .filter(Boolean)
      .join(' ');
  return (
    <div
      data-component="SoloCountBoard"
      data-testid={props.testId}
      data-position={props.position}
    >
      <ol>
        <For each={CELLS}>
          {(cell) => (
            <li data-cell={cell} data-mark={mark(cell)}>
              {cell} {mark(cell)}
            </li>
          )}
        </For>
      </ol>
      <For each={['one', 'two', 'three', 'stay', 'four']}>
        {(action) => (
          <button
            type="button"
            data-testid={`${props.testId}-${action}`}
            disabled={!props.interactive || props.mode !== 'play'}
            onClick={() => props.onAction(action)}
          >
            {action}
          </button>
        )}
      </For>
    </div>
  );
}

function useFeedback(): PuzzleFeedback {
  const preference = useSoundsPreference();
  const handles = createPlayFromStartHandles({
    right: createAudioPlayer(SOUNDS.right),
    wrong: createAudioPlayer(SOUNDS.wrong),
  });
  const play = (cue: 'right' | 'wrong') => {
    if (!preference.muted()) handles[cue].play();
  };
  return {
    onCorrectMove: () => play('right'),
    onWrongMove: () => play('wrong'),
    onSolved: () => {},
    onRatingComplete: () => {},
  };
}

const PUZZLES: PuzzlesCapability = {
  namespace: 'solo-count/',
  lineMode: 'solver-only',
  content: {
    validate: (record) =>
      record.id.startsWith('solo-count/') &&
      SOLO_COUNT_RULES.recognizes(record.position)
        ? { ok: true }
        : { ok: false, reason: 'id', detail: `${record.id} is not solo` },
  },
  marks: (position, action) => {
    const played = SOLO_COUNT_RULES.play(position, action, '', []);
    if (played === null) return null;
    const count = (p: string) => p.slice('solo-count:'.length, -1);
    return { from: count(position), to: count(played.position) };
  },
  isCell: (cell) => CELLS.includes(cell),
};

const CAPABILITIES = { puzzles: PUZZLES } satisfies TurnGameCapabilities;

const SHARED = defineTurnGame({
  rules: SOLO_COUNT_RULES,
  capabilities: CAPABILITIES,
  automation: probeAutomation(SOLO_COUNT_RULES),
});

const record = (
  id: string,
  position: string,
  line: string[]
): PuzzleRecord => ({
  id: `solo-count/${id}`,
  position,
  line,
  rating: 1450,
  ratingDeviation: 80,
  popularity: 90,
  plays: 10,
  themes: ['short'],
});

/** From three, two and two reach seven: both moves the solver's. */
const TWO_TWOS: PuzzleFixture = {
  record: record('two-twos', 'solo-count:3w', ['two', 'two']),
  solverSide: 'white',
  solution: ['two', 'two'],
  labels: ['two to 5', 'two to 7'],
  wrongMove: { at: 1, action: 'one' },
  refusedMove: { at: 1, action: 'three' },
};

const TWO_THREE: PuzzleFixture = {
  record: record('two-three', 'solo-count:2w', ['two', 'three']),
  solverSide: 'white',
  solution: ['two', 'three'],
  labels: ['two to 4', 'three to 7'],
  wrongMove: { at: 0, action: 'one' },
  refusedMove: { at: 0, action: 'four' },
  transposition: { at: 0, action: 'three' },
};

const ONE_TWO: PuzzleFixture = {
  record: record('one-two', 'solo-count:4w', ['one', 'two']),
  solverSide: 'white',
  solution: ['one', 'two'],
  labels: ['one to 5', 'two to 7'],
  wrongMove: { at: 1, action: 'one' },
  refusedMove: { at: 1, action: 'three' },
  transposition: { at: 0, action: 'two' },
  wonAnotherWay: { at: 0, action: 'three' },
};

/** Authored arithmetic, independent of the platform judge and puzzle engine. */
function morePuzzles(): readonly PuzzleFixture[] {
  const steps = { one: 1, two: 2, three: 3 };
  const lines: string[][] = [];
  const visit = (count: number, line: readonly string[]): void => {
    if (count === 7) {
      lines.push([...line]);
      return;
    }
    for (const [action, step] of Object.entries(steps))
      if (count + step <= 7) visit(count + step, [...line, action]);
  };
  visit(0, []);
  return lines.slice(0, 30).map((line, index) => {
    let count = 0;
    return {
      record: record(`more-${index}`, 'solo-count:0w', line),
      solverSide: 'white',
      solution: line,
      labels: line.map((action) => {
        count += steps[action as keyof typeof steps];
        return `${action} to ${count}`;
      }),
      wrongMove: {
        at: 0,
        action:
          Object.keys(steps).find(
            (action) => action !== line[0] && action !== line[1]
          ) ?? '',
      },
      refusedMove: { at: 0, action: 'four' },
    };
  });
}

export const SOLO_COUNT_GAME = assertHarnessGame({
  label: 'solo count',
  shared: SHARED,
  client: defineGameClient({
    shared: SHARED,
    title: 'Solo count',
    caption: 'Reach seven in the moves allowed',
    subtitle: () => 'Count on by one, two or three, alone.',
    presentation: probePresentation(SOLO_COUNT_RULES, {
      name: 'Solo count',
      sides: { white: 'Counter', black: 'Nobody' },
      endings: { 'counted to seven': 'Reached seven.' },
    }),
    puzzles: {
      Board: PuzzleBoard,
      useFeedback,
      themes: {
        choices: ['short', 'long'],
        label: (theme) => (theme === 'short' ? 'Short' : 'Long'),
      },
    },
  }),
  fixtures: {
    firstSideVictory: ['one', 'one', 'one', 'one', 'one', 'one', 'one'],
    firstSideVictoryLabels: [1, 2, 3, 4, 5, 6, 7].map(
      (count) => `one to ${String(count)}`
    ),
    refusedOpenings: ['four', ''],
    puzzles: [TWO_TWOS, TWO_THREE, ONE_TWO],
    morePuzzles: morePuzzles(),
  },
  puzzleSounds: {
    [SOUNDS.move]: 'move',
    [SOUNDS.right]: 'correct move',
    [SOUNDS.wrong]: 'wrong move',
    [SOUNDS.end]: 'end',
  },
});
